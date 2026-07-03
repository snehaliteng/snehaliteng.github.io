package com.snehalit.locationtracker

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class LocationService : Service() {

    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private var phone: String = ""
    private var connectivityCallback: ConnectivityManager.NetworkCallback? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    companion object {
        const val CHANNEL_ID = "location_channel"
        const val NOTIFICATION_ID = 1001
        const val SUPABASE_FUNCTION_URL = "https://vgipghqejzbcoighktij.supabase.co/functions/v1/push-location"
        const val SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaXBnaHFlanpiY29pZ2hrdGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjQ2MjIsImV4cCI6MjA5NTMwMDYyMn0.KoDwAZarGWOLwKXOwycA8wuIiIrksvZy7dyaO0-ehUo"
    }

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            for (location in result.locations) {
                pushLocation(location)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        android.util.Log.d("LocationTracker", "Service onCreate")
        try {
            fusedClient = LocationServices.getFusedLocationProviderClient(this)
            locationRequest = LocationRequest.Builder(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                5 * 60 * 1000L // 5 minutes
            ).apply {
                setMinUpdateIntervalMillis(5 * 60 * 1000L)
                setMaxUpdateDelayMillis(10 * 60 * 1000L)
            }.build()

            createNotificationChannel()
            registerNetworkCallback()
        } catch (e: Exception) {
            android.util.Log.e("LocationTracker", "Error in onCreate", e)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.d("LocationTracker", "Service onStartCommand")
        phone = intent?.getStringExtra("phone") ?: ""
        
        // CRITICAL: Must show notification immediately to avoid "Foreground Service Did Not Start In Time" crash
        val notification = createNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            android.util.Log.d("LocationTracker", "startForeground called successfully")
        } catch (e: Exception) {
            android.util.Log.e("LocationTracker", "Error starting foreground service", e)
            stopSelf()
            return START_NOT_STICKY
        }

        if (phone.isBlank()) {
            android.util.Log.w("LocationTracker", "Phone is blank, stopping service")
            stopSelf()
            return START_NOT_STICKY
        }

        startLocationUpdates()
        flushPendingQueue()

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            stopSelf()
            return
        }
        fusedClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
    }

    private fun pushLocation(location: Location) {
        try {
            val json = JSONObject().apply {
                put("phone", phone)
                put("latitude", location.latitude)
                put("longitude", location.longitude)
                put("accuracy", location.accuracy)
                put("battery_level", getBatteryLevel())
                put("recorded_at", java.time.Instant.now().toString())
            }

            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(SUPABASE_FUNCTION_URL)
                .post(body)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $SUPABASE_ANON_KEY")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    android.util.Log.e("LocationTracker", "Push error, queuing offline", e)
                    QueueManager.enqueue(this@LocationService, json)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        val respBody = response.body?.string() ?: "unknown"
                        if (!response.isSuccessful) {
                            android.util.Log.e("LocationTracker", "Push failed: $respBody")
                        } else if (respBody.contains("too_close") || respBody.contains("inserted\":false")) {
                            android.util.Log.w("LocationTracker", "Push skipped (too close to last): $respBody")
                        } else {
                            android.util.Log.d("LocationTracker", "Push successful: $respBody")
                        }
                    }
                }
            })
        } catch (e: Exception) {
            android.util.Log.e("LocationTracker", "Push error", e)
        }
    }

    private fun registerNetworkCallback() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    val hasInternet = cm.getNetworkCapabilities(network)
                        ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
                    if (hasInternet) {
                        flushPendingQueue()
                    }
                }
            }
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            cm.registerNetworkCallback(request, callback)
            connectivityCallback = callback
        } catch (e: Exception) {
            android.util.Log.e("LocationTracker", "Failed to register network callback", e)
        }
    }

    private fun flushPendingQueue() {
        Thread {
            try {
                val count = QueueManager.flush(this, client, SUPABASE_FUNCTION_URL, SUPABASE_ANON_KEY)
                if (count > 0) {
                    android.util.Log.d("LocationTracker", "Flushed $count pending locations")
                }
            } catch (e: Exception) {
                android.util.Log.e("LocationTracker", "Flush error", e)
            }
        }.start()
    }

    private fun getBatteryLevel(): Float {
        val intent = registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) (level.toFloat() / scale.toFloat()) * 100f else -1f
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = try { getString(R.string.channel_name) } catch (e: Exception) { "Location Tracking" }
            val desc = try { getString(R.string.channel_desc) } catch (e: Exception) { "Background location tracking service" }
            
            val channel = NotificationChannel(
                CHANNEL_ID,
                name,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = desc
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val stopIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("stopped", true)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val icon = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            android.R.drawable.ic_menu_mylocation
        } else {
            android.R.drawable.ic_dialog_info
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Location Tracker")
            .setContentText("Tracking: $phone")
            .setSmallIcon(icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        if (::fusedClient.isInitialized) {
            fusedClient.removeLocationUpdates(locationCallback)
        }
        try {
            connectivityCallback?.let {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                cm.unregisterNetworkCallback(it)
            }
        } catch (e: Exception) {
            android.util.Log.e("LocationTracker", "Error unregistering network callback", e)
        }
        super.onDestroy()
    }
}
