package com.snehalit.locationtracker

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var emailDisplay: TextView
    private lateinit var startBtn: Button
    private lateinit var pushNowBtn: Button
    private lateinit var stopBtn: Button
    private lateinit var batteryBtn: Button

    private var phone: String = ""

    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val foregroundGranted = granted[Manifest.permission.ACCESS_FINE_LOCATION] ?: (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)
        val notificationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            granted[Manifest.permission.POST_NOTIFICATIONS] ?: (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
        } else {
            true
        }

        if (foregroundGranted && notificationGranted) {
            checkBackgroundPermissionAndStart()
        } else {
            Toast.makeText(this, "Location and Notification permissions are required", Toast.LENGTH_LONG).show()
        }
    }

    private val batteryOptLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { startTracking() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Thread.setDefaultUncaughtExceptionHandler { _, e ->
            runOnUiThread {
                Toast.makeText(this, "CRASH: ${e.message}", Toast.LENGTH_LONG).show()
                android.util.Log.e("LocationTracker", "Global Crash", e)
            }
        }

        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.status_text)
        emailDisplay = findViewById(R.id.configured_email)
        startBtn = findViewById(R.id.start_btn)
        pushNowBtn = findViewById(R.id.push_now_btn)
        stopBtn = findViewById(R.id.stop_btn)
        batteryBtn = findViewById(R.id.battery_btn)

        startBtn.setOnClickListener { checkPermissionsAndStart() }
        pushNowBtn.setOnClickListener { pushLocationNow() }
        stopBtn.setOnClickListener { stopTracking() }
        batteryBtn.setOnClickListener { requestBatteryOptimization() }
        emailDisplay.setOnClickListener { logout() }

        phone = intent?.getStringExtra("phone")
            ?: getSharedPreferences("tracker", MODE_PRIVATE).getString("phone", "")
            ?: ""

        if (phone.isBlank()) {
            goToLogin()
            return
        }

        emailDisplay.text = phone
        startBtn.isEnabled = true
        pushNowBtn.isEnabled = true

        updateStatus(false)
    }

    private fun logout() {
        stopTracking()
        getSharedPreferences("tracker", MODE_PRIVATE).edit().clear().apply()
        Toast.makeText(this, "Logged out", Toast.LENGTH_SHORT).show()
        goToLogin()
    }

    private fun goToLogin() {
        val intent = Intent(this, LoginActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        startActivity(intent)
        finish()
    }

    private fun checkPermissionsAndStart() {
        if (phone.isBlank()) { goToLogin(); return }

        val permissions = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (permissions.isNotEmpty()) {
            locationPermissionLauncher.launch(permissions.toTypedArray())
        } else {
            checkBackgroundPermissionAndStart()
        }
    }

    private fun checkBackgroundPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION))
        } else {
            startTracking()
        }
    }

    private fun requestBatteryOptimization() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(packageName)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = android.net.Uri.parse("package:$packageName")
            }
            batteryOptLauncher.launch(intent)
        } else {
            Toast.makeText(this, "Battery optimization already disabled", Toast.LENGTH_SHORT).show()
        }
    }

    private fun startTracking() {
        if (phone.isBlank()) { goToLogin(); return }

        try {
            val serviceIntent = Intent(this, LocationService::class.java).apply {
                putExtra("phone", phone)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to start service: ${e.message}", Toast.LENGTH_LONG).show()
            android.util.Log.e("LocationTracker", "Start service failed", e)
        }

        val workRequest = PeriodicWorkRequestBuilder<LocationWorker>(15, TimeUnit.MINUTES)
            .setInitialDelay(1, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "location_push",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )

        updateStatus(true)
        Toast.makeText(this, "Tracking started", Toast.LENGTH_SHORT).show()
    }

    private fun pushLocationNow() {
        if (phone.isBlank()) { goToLogin(); return }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Location permission is required", Toast.LENGTH_SHORT).show()
            return
        }

        val workRequest = OneTimeWorkRequestBuilder<LocationWorker>().build()
        WorkManager.getInstance(this).enqueue(workRequest)

        Toast.makeText(this, "Pushing location...", Toast.LENGTH_SHORT).show()
    }

    private fun stopTracking() {
        val serviceIntent = Intent(this, LocationService::class.java)
        stopService(serviceIntent)

        WorkManager.getInstance(this).cancelUniqueWork("location_push")

        updateStatus(false)
    }

    private fun updateStatus(isRunning: Boolean) {
        statusText.text = if (isRunning) "Tracking Active" else "Not Tracking"
        statusText.setTextColor(
            ContextCompat.getColor(this, if (isRunning) android.R.color.holo_green_dark else android.R.color.darker_gray)
        )
        startBtn.isEnabled = !isRunning && phone.isNotBlank()
        stopBtn.isEnabled = isRunning
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra("stopped", false)) {
            updateStatus(false)
        }
    }
}
