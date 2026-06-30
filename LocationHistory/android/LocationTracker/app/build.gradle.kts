plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.snehalit.locationtracker"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.snehalit.locationtracker"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")

    // Google Play Services Location
    implementation("com.google.android.gms:play-services-location:21.1.0")

    // WorkManager for periodic background work
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // OkHttp for HTTP calls
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
