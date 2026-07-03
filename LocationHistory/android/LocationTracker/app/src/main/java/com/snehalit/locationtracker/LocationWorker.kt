package com.snehalit.locationtracker

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Location
import android.os.BatteryManager
import androidx.core.app.ActivityCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.Tasks
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class LocationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("tracker", Context.MODE_PRIVATE)
        val phone = prefs.getString("phone", "") ?: ""

        if (phone.isBlank()) return Result.success()

        if (ActivityCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return Result.success()
        }

        // Flush any queued locations from offline periods
        try {
            QueueManager.flush(applicationContext, client, LocationService.SUPABASE_FUNCTION_URL, LocationService.SUPABASE_ANON_KEY)
        } catch (e: Exception) {
            android.util.Log.e("LocationWorker", "Flush error", e)
        }

        return try {
            val fusedClient = LocationServices.getFusedLocationProviderClient(applicationContext)

            val task = fusedClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
            val location = Tasks.await(task, 30, TimeUnit.SECONDS)

            if (location != null) {
                pushLocation(phone, location)
            }
            Result.success()
        } catch (e: Exception) {
            android.util.Log.e("LocationWorker", "Error", e)
            Result.retry()
        }
    }

    private fun pushLocation(phone: String, location: Location) {
        val json = JSONObject().apply {
            put("phone", phone)
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("accuracy", location.accuracy)
            put("battery_level", getBatteryLevel())
            put("recorded_at", java.time.Instant.now().toString())
        }

        try {
            val body = json.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url(LocationService.SUPABASE_FUNCTION_URL)
                .post(body)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer ${LocationService.SUPABASE_ANON_KEY}")
                .build()

            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: "unknown"
                if (!response.isSuccessful) {
                    android.util.Log.e("LocationWorker", "Push failed, queuing: $body")
                    QueueManager.enqueue(applicationContext, json)
                } else if (body.contains("too_close") || body.contains("inserted\":false")) {
                    android.util.Log.w("LocationWorker", "Push skipped (too close): $body")
                } else {
                    android.util.Log.d("LocationWorker", "Push successful: $body")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("LocationWorker", "Push network error, queuing", e)
            QueueManager.enqueue(applicationContext, json)
        }
    }

    private fun getBatteryLevel(): Float {
        val intent = applicationContext.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) (level.toFloat() / scale.toFloat()) * 100f else -1f
    }
}
