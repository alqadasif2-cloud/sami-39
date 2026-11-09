buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.5.2")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24")
        classpath("com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:1.9.24-1.0.20")
        classpath("com.google.gms:google-services:4.4.2")
    }
}
