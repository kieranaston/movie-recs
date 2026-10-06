import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Secrets and machine-specific settings live in the gitignored local.properties, never in source.
val local = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}
fun quoted(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

/** CI passes settings as environment variables; locally they come from local.properties. */
fun setting(property: String, env: String): String? =
    providers.environmentVariable(env).orNull?.takeIf { it.isNotBlank() } ?: local.getProperty(property)

val releaseBaseUrl: String = local.getProperty("api.baseUrl", "https://movie-recs-tawny.vercel.app")
val debugBaseUrl: String = local.getProperty("api.debugBaseUrl", releaseBaseUrl)
val releaseKeystore: String? = setting("release.storeFile", "RELEASE_STORE_FILE")
val isCi = providers.environmentVariable("CI").orNull == "true"
/** For CI builds that only verify the release build compiles/minifies (never published): `-PverifyOnly=true`. */
val verifyOnly = providers.gradleProperty("verifyOnly").orNull == "true"

android {
    namespace = "com.kieranaston.movierecs"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.kieranaston.movierecs"
        minSdk = 26
        targetSdk = 37
        // CI sets these per release (each must be higher than the last for Android to accept the update).
        versionCode = providers.environmentVariable("VERSION_CODE").orNull?.toInt() ?: 1
        versionName = providers.environmentVariable("VERSION_NAME").orNull ?: "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = file(releaseKeystore)
                storePassword = setting("release.storePassword", "RELEASE_STORE_PASSWORD")
                keyAlias = setting("release.keyAlias", "RELEASE_KEY_ALIAS")
                keyPassword = setting("release.keyPassword", "RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Installs alongside the release build, labelled so you can tell them apart.
            applicationIdSuffix = ".debug"
            resValue("string", "app_name", "Movie Recs Dev")
            buildConfigField("String", "API_BASE_URL", quoted(debugBaseUrl))
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            resValue("string", "app_name", "Movie Recs")
            buildConfigField("String", "API_BASE_URL", quoted(releaseBaseUrl))
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true // android.* stubs (e.g. Log) return defaults in JVM tests
    }

    lint {
        warningsAsErrors = true
        abortOnError = true
    }
}

// Refuse to produce a release APK that would talk to the server insecurely,
// or (in CI) one signed with a throwaway key that couldn't update the installed app.
val checkReleaseConfig = tasks.register("checkReleaseConfig") {
    val url = releaseBaseUrl
    val unsignedInCi = isCi && releaseKeystore == null && !verifyOnly
    doLast {
        require(url.startsWith("https://")) { "api.baseUrl must be https:// for release builds (got $url)" }
        require(!unsignedInCi) { "CI release builds need RELEASE_STORE_FILE (and passwords) to sign with the release key" }
    }
}
tasks.matching { it.name == "preReleaseBuild" }.configureEach { dependsOn(checkReleaseConfig) }

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.foundation)
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.core.ktx)
    implementation(libs.tv.material)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.navigation.compose)
    implementation(libs.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.zxing.core)

    testImplementation(libs.junit)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.mockwebserver)

    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
