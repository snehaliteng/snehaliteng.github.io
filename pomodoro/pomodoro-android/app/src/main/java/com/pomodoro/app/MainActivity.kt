package com.pomodoro.app

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.slider.Slider

class MainActivity : AppCompatActivity() {

    private lateinit var timerText: TextView
    private lateinit var sessionLabel: TextView
    private lateinit var cycleCount: TextView
    private lateinit var startButton: Button
    private lateinit var pauseButton: Button
    private lateinit var resetButton: Button
    private lateinit var stopButton: Button

    private lateinit var workSlider: Slider
    private lateinit var breakSlider: Slider
    private lateinit var workValue: TextView
    private lateinit var breakValue: TextView
    private lateinit var saveSettingsButton: Button

    private lateinit var prefs: SharedPreferences
    private var workMinutes = 25
    private var breakMinutes = 5

    private var ringtone: Ringtone? = null

    private val pollingHandler = Handler(Looper.getMainLooper())
    private val pollingRunnable = object : Runnable {
        private var lastIsWork = true
        override fun run() {
            if (!TimerService.isRunning()) {
                pollingHandler.removeCallbacks(this)
                return
            }
            val remaining = TimerService.getRemainingSeconds()
            val isWork = TimerService.isWorkSession()
            val cycle = TimerService.getCycle()
            timerText.text = TimerService.formatTime(remaining)
            sessionLabel.text = if (isWork) "Focus" else "Break"
            cycleCount.text = "Cycle #$cycle"
            if (lastIsWork != isWork) {
                showSessionEndDialog(if (lastIsWork) "Great focus! Take a break." else "Break is over, time to focus!")
            }
            lastIsWork = isWork
            pollingHandler.postDelayed(this, 500)
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (!granted) {
            showPermissionDeniedDialog()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("pomodoro_prefs", MODE_PRIVATE)
        workMinutes = prefs.getInt("work_minutes", 25)
        breakMinutes = prefs.getInt("break_minutes", 5)

        initViews()
        setupListeners()
        requestNotificationPermission()
        syncWithServiceState()
    }

    private fun initViews() {
        timerText = findViewById(R.id.timerText)
        sessionLabel = findViewById(R.id.sessionLabel)
        cycleCount = findViewById(R.id.cycleCount)
        startButton = findViewById(R.id.startButton)
        pauseButton = findViewById(R.id.pauseButton)
        resetButton = findViewById(R.id.resetButton)
        stopButton = findViewById(R.id.stopButton)

        workSlider = findViewById(R.id.workDurationSlider)
        breakSlider = findViewById(R.id.breakDurationSlider)
        workValue = findViewById(R.id.workDurationValue)
        breakValue = findViewById(R.id.breakDurationValue)
        saveSettingsButton = findViewById(R.id.saveSettingsButton)
    }

    private fun setupListeners() {
        workSlider.addOnChangeListener { _, value, _ ->
            workValue.text = "${value.toInt()} min"
        }
        breakSlider.addOnChangeListener { _, value, _ ->
            breakValue.text = "${value.toInt()} min"
        }

        workSlider.value = workMinutes.toFloat()
        breakSlider.value = breakMinutes.toFloat()
        workValue.text = "$workMinutes min"
        breakValue.text = "$breakMinutes min"

        startButton.setOnClickListener {
            if (TimerService.isRunning()) return@setOnClickListener
            val intent = Intent(this, TimerService::class.java).apply {
                action = TimerService.ACTION_START
                putExtra(TimerService.EXTRA_WORK_MINUTES, workMinutes)
                putExtra(TimerService.EXTRA_BREAK_MINUTES, breakMinutes)
            }
            ContextCompat.startForegroundService(this, intent)
            startButton.isEnabled = false
            pauseButton.isEnabled = true
        }

        pauseButton.setOnClickListener {
            val intent = Intent(this, TimerService::class.java).apply {
                action = TimerService.ACTION_PAUSE
            }
            startService(intent)
            startButton.isEnabled = true
            startButton.text = "Resume"
        }

        resetButton.setOnClickListener {
            val intent = Intent(this, TimerService::class.java).apply {
                action = TimerService.ACTION_RESET
            }
            startService(intent)
            timerText.text = TimerService.formatTime(workMinutes * 60)
            sessionLabel.text = "Focus"
            cycleCount.text = "Cycle #1"
            startButton.isEnabled = true
            startButton.text = "Start"
            pauseButton.isEnabled = false
        }

        stopButton.setOnClickListener {
            val intent = Intent(this, TimerService::class.java).apply {
                action = TimerService.ACTION_STOP
            }
            startService(intent)
            timerText.text = TimerService.formatTime(workMinutes * 60)
            sessionLabel.text = "Focus"
            cycleCount.text = "Cycle #1"
            startButton.isEnabled = true
            startButton.text = "Start"
            pauseButton.isEnabled = false
        }

        saveSettingsButton.setOnClickListener {
            workMinutes = workSlider.value.toInt()
            breakMinutes = breakSlider.value.toInt()
            prefs.edit().putInt("work_minutes", workMinutes).putInt("break_minutes", breakMinutes).apply()
            if (!TimerService.isRunning()) {
                timerText.text = TimerService.formatTime(workMinutes * 60)
                sessionLabel.text = "Focus"
                cycleCount.text = "Cycle #1"
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED -> { }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    showPermissionRationale()
                }
                else -> {
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        }
    }

    private fun showPermissionRationale() {
        AlertDialog.Builder(this)
            .setTitle("Notification Permission")
            .setMessage("The app needs notification permission to show timer updates and alerts.")
            .setPositiveButton("Grant") { _, _ ->
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            .setNegativeButton("Deny", null)
            .show()
    }

    private fun showPermissionDeniedDialog() {
        AlertDialog.Builder(this)
            .setTitle("Permission Denied")
            .setMessage("Timer notifications may not work without notification permission.")
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showSessionEndDialog(message: String) {
        playAlarm()
        vibrate()
        AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
            .setTitle("Time's up!")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ ->
                ringtone?.stop()
            }
            .show()
    }

    private fun playAlarm() {
        try {
            val alarmUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ringtone?.stop()
            ringtone = RingtoneManager.getRingtone(this, alarmUri)
            ringtone?.play()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun vibrate() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(VIBRATOR_SERVICE) as Vibrator
            }
            val effect = VibrationEffect.createOneShot(2000, VibrationEffect.DEFAULT_AMPLITUDE)
            vibrator.vibrate(effect)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun syncWithServiceState() {
        if (TimerService.isRunning()) {
            val remaining = TimerService.getRemainingSeconds()
            val isWork = TimerService.isWorkSession()
            val cycle = TimerService.getCycle()
            updateUI(remaining, isWork, cycle)
            startButton.isEnabled = false
            pauseButton.isEnabled = true
        }
    }

    private fun updateUI(remainingSeconds: Int, isWork: Boolean, cycle: Int) {
        timerText.text = TimerService.formatTime(remainingSeconds)
        sessionLabel.text = if (isWork) "Focus" else "Break"
        cycleCount.text = "Cycle #$cycle"
    }

    override fun onResume() {
        super.onResume()
        syncWithServiceState()
        pollingHandler.post(pollingRunnable)
    }

    override fun onPause() {
        super.onPause()
        pollingHandler.removeCallbacks(pollingRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        ringtone?.stop()
    }
}
