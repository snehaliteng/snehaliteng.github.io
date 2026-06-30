package com.snehalit.locationtracker

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var identifierInput: EditText
    private lateinit var startBtn: Button
    private lateinit var pushNowBtn: Button
    private lateinit var stopBtn: Button
    private lateinit var batteryBtn: Button

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
            // If we have foreground and notification, check for background
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
        identifierInput = findViewById(R.id.identifier_input)
        startBtn = findViewById(R.id.start_btn)
        pushNowBtn = findViewById(R.id.push_now_btn)
        stopBtn = findViewById(R.id.stop_btn)
        batteryBtn = findViewById(R.id.battery_btn)

        startBtn.setOnClickListener { checkPermissionsAndStart() }
        pushNowBtn.setOnClickListener { pushLocationNow() }
        stopBtn.setOnClickListener { stopTracking() }
        batteryBtn.setOnClickListener { requestBatteryOptimization() }

        updateStatus(false)
        loadIdentifier()
    }

    private fun loadIdentifier() {
        val prefs = getSharedPreferences("tracker", MODE_PRIVATE)
        val saved = prefs.getString("phone", "")
        if (!saved.isNullOrBlank()) {
            identifierInput.setText(saved)
        }
    }

    private fun saveIdentifier(phone: String) {
        getSharedPreferences("tracker", MODE_PRIVATE).edit().putString("phone", phone).apply()
    }

    private fun checkPermissionsAndStart() {
        val phone = identifierInput.text.toString().trim()
        if (phone.isBlank()) {
            Toast.makeText(this, "Enter phone number or email", Toast.LENGTH_SHORT).show()
            return
        }
        saveIdentifier(phone)

        val permissions = mutableListOf<String>()
        
        // 1. Check Foreground Location
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }

        // 2. Check Notifications (Required for Foreground Service in Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (permissions.isNotEmpty()) {
            locationPermissionLauncher.launch(permissions.toTypedArray())
        } else {
            // Already have foreground and notifications, now check background
            checkBackgroundPermissionAndStart()
        }
    }

    private fun checkBackgroundPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            // On Android 11+, you must request background location separately
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
        val phone = identifierInput.text.toString().trim()
        saveIdentifier(phone)

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

        // Also schedule periodic WorkManager task as backup
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
        val phone = identifierInput.text.toString().trim()
        if (phone.isBlank()) {
            Toast.makeText(this, "Enter phone number or email first", Toast.LENGTH_SHORT).show()
            return
        }
        saveIdentifier(phone)

        // Check for basic location permission
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Toast.makeText(this, "Location permission is required to push location", Toast.LENGTH_SHORT).show()
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
        Toast.makeText(this, "Tracking stopped", Toast.LENGTH_SHORT).show()
    }

    private fun updateStatus(isRunning: Boolean) {
        statusText.text = if (isRunning) "Tracking Active" else "Not Tracking"
        statusText.setTextColor(
            ContextCompat.getColor(this, if (isRunning) android.R.color.holo_green_dark else android.R.color.darker_gray)
        )
        startBtn.isEnabled = !isRunning
        stopBtn.isEnabled = isRunning
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra("stopped", false)) {
            updateStatus(false)
        }
    }
}
