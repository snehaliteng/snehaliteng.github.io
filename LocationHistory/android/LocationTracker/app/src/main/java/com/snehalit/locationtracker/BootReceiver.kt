package com.snehalit.locationtracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("tracker", Context.MODE_PRIVATE)
            val phone = prefs.getString("phone", "") ?: ""

            if (phone.isNotBlank()) {
                val serviceIntent = Intent(context, LocationService::class.java).apply {
                    putExtra("phone", phone)
                }
                ContextCompat.startForegroundService(context, serviceIntent)
            }
        }
    }
}
