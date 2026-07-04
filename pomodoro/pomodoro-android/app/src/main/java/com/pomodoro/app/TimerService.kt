package com.pomodoro.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

class TimerService : Service() {

    companion object {
        const val CHANNEL_ID = "pomodoro_timer"
        const val NOTIFICATION_ID = 1
        const val ACTION_START = "com.pomodoro.app.START"
        const val ACTION_PAUSE = "com.pomodoro.app.PAUSE"
        const val ACTION_RESET = "com.pomodoro.app.RESET"
        const val ACTION_STOP = "com.pomodoro.app.STOP"
        const val ACTION_TICK = "com.pomodoro.app.TICK"
        const val ACTION_SESSION_END = "com.pomodoro.app.SESSION_END"
        const val ACTION_CYCLE_CHANGED = "com.pomodoro.app.CYCLE_CHANGED"

        const val EXTRA_WORK_MINUTES = "work_minutes"
        const val EXTRA_BREAK_MINUTES = "break_minutes"
        const val EXTRA_REMAINING_SECONDS = "remaining_seconds"
        const val EXTRA_IS_WORK = "is_work"
        const val EXTRA_CYCLE = "cycle"

        private var isRunning = false
        private var isWorkSession = true
        private var remainingSeconds = 0
        private var workSeconds = 25 * 60
        private var breakSeconds = 5 * 60
        private var cycle = 1

        fun isRunning(): Boolean = isRunning
        fun isWorkSession(): Boolean = isWorkSession
        fun getRemainingSeconds(): Int = remainingSeconds
        fun getCycle(): Int = cycle

        fun formatTime(seconds: Int): String {
            val mins = seconds / 60
            val secs = seconds % 60
            return String.format("%02d:%02d", mins, secs)
        }
    }

    private var timerThread: Thread? = null
    private var running = false
    private var ringtone: Ringtone? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                workSeconds = intent.getIntExtra(EXTRA_WORK_MINUTES, 25) * 60
                breakSeconds = intent.getIntExtra(EXTRA_BREAK_MINUTES, 5) * 60
                if (!isRunning) {
                    isWorkSession = true
                    remainingSeconds = workSeconds
                    cycle = 1
                }
                startTimer()
            }
            ACTION_PAUSE -> {
                pauseTimer()
            }
            ACTION_RESET -> {
                resetTimer()
            }
            ACTION_STOP -> {
                stopTimer()
                stopForegroundCompat()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startTimer() {
        if (running) return
        running = true
        isRunning = true

        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)

        timerThread = Thread {
            try {
                while (running && remainingSeconds > 0) {
                    try {
                        Thread.sleep(1000)
                    } catch (e: InterruptedException) {
                        break
                    }
                    if (!running) break
                    remainingSeconds--
                    sendTickBroadcast()

                    if (remainingSeconds <= 0) {
                        playAlarm()
                        vibrate()
                        if (isWorkSession) {
                            isWorkSession = false
                            remainingSeconds = breakSeconds
                            sendSessionEndBroadcast("Break time!")
                        } else {
                            isWorkSession = true
                            cycle++
                            remainingSeconds = workSeconds
                            sendSessionEndBroadcast("Focus time!")
                        }
                        sendCycleChangedBroadcast()
                        updateNotification()
                    } else {
                        updateNotification()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                if (remainingSeconds <= 0) {
                    isRunning = false
                    running = false
                    Handler(Looper.getMainLooper()).post {
                        stopForegroundCompat()
                        stopSelf()
                    }
                }
            }
        }
        timerThread?.start()
    }

    private fun pauseTimer() {
        running = false
        isRunning = false
        timerThread?.interrupt()
        updateNotification()
    }

    private fun resetTimer() {
        running = false
        isRunning = false
        timerThread?.interrupt()
        isWorkSession = true
        remainingSeconds = workSeconds
        cycle = 1
        sendTickBroadcast()
        sendCycleChangedBroadcast()
        updateNotification()
    }

    private fun stopTimer() {
        running = false
        isRunning = false
        timerThread?.interrupt()
        remainingSeconds = 0
    }

    private fun sendTickBroadcast() {
        val intent = Intent(ACTION_TICK).apply {
            putExtra(EXTRA_REMAINING_SECONDS, remainingSeconds)
            putExtra(EXTRA_IS_WORK, isWorkSession)
            putExtra(EXTRA_CYCLE, cycle)
        }
        sendBroadcast(intent)
    }

    private fun sendSessionEndBroadcast(message: String) {
        val intent = Intent(ACTION_SESSION_END).apply {
            putExtra(EXTRA_IS_WORK, isWorkSession)
            putExtra(EXTRA_CYCLE, cycle)
            putExtra("message", message)
        }
        sendBroadcast(intent)
    }

    private fun sendCycleChangedBroadcast() {
        val intent = Intent(ACTION_CYCLE_CHANGED).apply {
            putExtra(EXTRA_CYCLE, cycle)
            putExtra(EXTRA_IS_WORK, isWorkSession)
        }
        sendBroadcast(intent)
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

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Pomodoro Timer",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows current timer status"
            setSound(null, null)
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    private fun createNotification(): Notification {
        val sessionType = if (isWorkSession) "Focus" else "Break"
        val timeStr = formatTime(remainingSeconds)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Pomodoro - $sessionType")
            .setContentText("$timeStr  |  Cycle #$cycle")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification() {
        val nm = getSystemService(NotificationManager::class.java)
        if (running) {
            nm.notify(NOTIFICATION_ID, createNotification())
        } else if (isRunning) {
            val sessionType = if (isWorkSession) "Focus" else "Break"
            val timeStr = formatTime(remainingSeconds)
            val notification = NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Pomodoro - Paused")
                .setContentText("$sessionType: $timeStr  |  Cycle #$cycle")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build()
            nm.notify(NOTIFICATION_ID, notification)
        } else {
            nm.cancel(NOTIFICATION_ID)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        running = false
        ringtone?.stop()
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

}
