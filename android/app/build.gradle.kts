plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.github.manager"
    compileSdk = 34

    // ── 签名配置：使用 CI 生成的 keystore，确保覆盖安装签名一致 ──
    signingConfigs {
        create("ci") {
            storeFile = file("../ci-release.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD") ?: "github-manager"
            keyAlias = System.getenv("KEY_ALIAS") ?: "github-manager"
            keyPassword = System.getenv("KEY_PASSWORD") ?: "github-manager"
        }
    }

    defaultConfig {
        applicationId = "com.github.manager"
        minSdk = 26          // Android 8.0+，覆盖主流设备
        targetSdk = 34
        // 版本号：环境变量 > 默认值
        versionCode = (System.getenv("VERSION_CODE")?.toIntOrNull() ?: 1)
        versionName = System.getenv("VERSION_NAME") ?: "1.0.0"
    }

    buildTypes {
        debug {
            isDebuggable = true
            // debug 也使用 CI 签名，便于开发阶段覆盖安装
            signingConfig = signingConfigs.getByName("ci")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("ci")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // assets 目录由 CI workflow 在构建前填充（dist/ 内容）
    sourceSets {
        getByName("main") {
            assets.srcDirs("src/main/assets")
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // activity-ktx：registerForActivityResult / ActivityResultContracts
    implementation("androidx.activity:activity-ktx:1.9.3")
    // Material 组件：BottomNavigationView
    implementation("com.google.android.material:material:1.12.0")
}