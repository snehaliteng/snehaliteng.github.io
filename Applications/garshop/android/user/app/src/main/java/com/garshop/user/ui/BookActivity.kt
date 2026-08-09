package com.garshop.user.ui

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.garshop.user.api.Session
import com.garshop.user.api.Supabase
import org.json.JSONObject

class BookActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Session.init(this)

        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 64, 40, 40)
        }
        root.addView(TextView(this).apply {
            text = "Book Appointment"
            textSize = 24f
            setPadding(0, 0, 0, 20)
        })

        val etGarageId = EditText(this).apply { hint = "Garage ID"; setSingleLine(true); inputType = android.text.InputType.TYPE_CLASS_NUMBER }
        val etCarId = EditText(this).apply { hint = "Car ID"; setSingleLine(true); inputType = android.text.InputType.TYPE_CLASS_NUMBER }
        val etServiceId = EditText(this).apply { hint = "Service ID (optional)"; setSingleLine(true); inputType = android.text.InputType.TYPE_CLASS_NUMBER }
        val etDateTime = EditText(this).apply { hint = "Date & time (YYYY-MM-DDTHH:MM:SS)"; setSingleLine(true) }
        val etNotes = EditText(this).apply { hint = "Notes (e.g. doorstep pickup)" }
        val btnBook = Button(this).apply { text = "Book Appointment" }

        root.addView(etGarageId)
        root.addView(etCarId)
        root.addView(etServiceId)
        root.addView(etDateTime)
        root.addView(etNotes)
        root.addView(btnBook)

        scroll.addView(root)
        setContentView(scroll)

        btnBook.setOnClickListener {
            val gid = etGarageId.text.toString().trim()
            val cid = etCarId.text.toString().trim()
            val dt = etDateTime.text.toString().trim()
            if (gid.isEmpty() || cid.isEmpty() || dt.isEmpty()) {
                Toast.makeText(this, "Garage ID, Car ID and date/time required", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            btnBook.isEnabled = false
            Thread {
                try {
                    val obj = JSONObject()
                        .put("user_id", Session.uid())
                        .put("garage_id", gid.toLong())
                        .put("car_id", cid.toLong())
                        .put("scheduled_at", dt)
                        .put("notes", etNotes.text.toString().trim())
                    val sid = etServiceId.text.toString().trim().toLongOrNull()
                    if (sid != null) obj.put("service_id", sid)
                    Supabase.insert("gs_appointments", obj)

                    val garages = Supabase.select("gs_garages", "id=eq.$gid&select=owner_id")
                    if (garages.length() > 0) {
                        val notif = JSONObject()
                            .put("user_id", garages.getJSONObject(0).optString("owner_id"))
                            .put("title", "New appointment")
                            .put("message", "A user booked an appointment at your garage.")
                            .put("type", "info")
                        Supabase.insert("gs_notifications", notif)
                    }

                    runOnUiThread {
                        btnBook.isEnabled = true
                        Toast.makeText(this, "Appointment booked!", Toast.LENGTH_LONG).show()
                        finish()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        btnBook.isEnabled = true
                        Toast.makeText(this, e.message ?: "Failed", Toast.LENGTH_LONG).show()
                    }
                }
            }.start()
        }
    }
}
