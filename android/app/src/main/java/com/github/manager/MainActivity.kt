package com.github.manager

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashOverlay: View
    private var splashDismissed = false

    // ── 文件上传 ────────────────────────────────────────────────────
    /** WebView <input type="file"> 回调，必须在选择完成后调用，否则 input 卡死 */
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    /** 相机拍照临时文件的 content:// URI（通过 FileProvider 生成） */
    private var cameraImageUri: Uri? = null

    /** 文件选择器 / 相机结果回调 */
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris: Array<Uri>? = if (result.resultCode == RESULT_OK) {
            result.data?.let { data ->
                when {
                    // 多选
                    data.clipData != null ->
                        Array(data.clipData!!.itemCount) { i ->
                            data.clipData!!.getItemAt(i).uri
                        }
                    // 单选文件
                    data.data != null -> arrayOf(data.data!!)
                    // 相机拍照（data 为 null，使用预创建 URI）
                    else -> cameraImageUri?.let { arrayOf(it) }
                }
            }
        } else null

        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

    // ── 运行时权限 ──────────────────────────────────────────────────
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        val denied = granted.filterValues { !it }.keys
        if (denied.isNotEmpty()) {
            Toast.makeText(
                this,
                "以下权限被拒绝，上传/下载功能可能受限：\n${denied.joinToString("\n") { it.substringAfterLast(".") }}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    // ── 下载完成广播 ────────────────────────────────────────────────
    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Toast.makeText(
                context,
                "✓ 文件已下载完成，保存至「下载」文件夹",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    // ── JS 桥接口 ───────────────────────────────────────────────────
    inner class WebAppBridge {
        /** React 首屏就绪后调用，触发启动遮罩淡出 */
        @JavascriptInterface
        fun notifyReady() {
            runOnUiThread { dismissSplash() }
        }
    }

    private fun dismissSplash() {
        if (splashDismissed) return
        splashDismissed = true
        splashOverlay.animate().alpha(0f).setDuration(250)
            .withEndAction { splashOverlay.visibility = View.GONE }.start()
    }

    // ── 生命周期 ────────────────────────────────────────────────────
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.parseColor("#0d1117")
        window.navigationBarColor = Color.parseColor("#0d1117")

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        splashOverlay = findViewById(R.id.splashOverlay)

        // 启动时申请所需权限
        requestRequiredPermissions()

        // 注册下载完成广播
        registerDownloadReceiver()

        // 配置 WebView
        setupWebViewSettings()
        setupWebViewClient()
        setupWebChromeClient()
        setupDownloadListener()

        webView.addJavascriptInterface(WebAppBridge(), "AndroidBridge")

        // 5 秒超时兜底，防止 notifyReady 因异常未调用
        Handler(Looper.getMainLooper()).postDelayed({ dismissSplash() }, 5000)

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            webView.loadUrl("file:///android_asset/index.html")
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(downloadReceiver)
        webView.stopLoading()
        webView.destroy()
    }

    @Deprecated("onBackPressed is deprecated but still needed for WebView navigation")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    // ── 权限申请 ────────────────────────────────────────────────────

    private fun requestRequiredPermissions() {
        val required = buildList {
            add(Manifest.permission.CAMERA)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+：细粒度媒体权限
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.READ_MEDIA_VIDEO)
                add(Manifest.permission.READ_MEDIA_AUDIO)
            } else {
                // Android 6–12：通用存储读权限
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
                if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
                    // Android 9 及以下：需要写权限
                    add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                }
            }
        }

        val denied = required.filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }

        if (denied.isNotEmpty()) {
            permissionLauncher.launch(denied.toTypedArray())
        }
    }

    // ── WebView 配置 ────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebViewSettings() {
        webView.setBackgroundColor(Color.parseColor("#0d1117"))
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            @Suppress("SetJavaScriptEnabled")
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            displayZoomControls = false
            builtInZoomControls = false
            mediaPlaybackRequiresUserGesture = false
        }
    }

    private fun setupWebViewClient() {
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                // file:// / https:// / http:// 在 WebView 内处理
                return !url.startsWith("file://") &&
                    !url.startsWith("https://") &&
                    !url.startsWith("http://")
            }
        }
    }

    /** WebChromeClient：处理 HTML <input type="file"> 文件选择 */
    private fun setupWebChromeClient() {
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                // 取消上一个未完成的回调，防止 input 卡死
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback

                // 构建文件选择 Intent
                val fileIntent = runCatching { fileChooserParams.createIntent() }.getOrNull()
                    ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    }

                // 构建相机拍照 Intent（失败则不附加）
                val cameraIntent = createCameraIntent()

                // 合并为统一选择器
                val extraIntents = listOfNotNull(cameraIntent).toTypedArray()
                val chooserIntent = Intent.createChooser(fileIntent, "选择文件或拍照").apply {
                    if (extraIntents.isNotEmpty()) {
                        putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents)
                    }
                }

                return runCatching {
                    fileChooserLauncher.launch(chooserIntent)
                    true
                }.getOrElse {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    /** DownloadListener：拦截 WebView 下载请求，交由 DownloadManager 处理 */
    private fun setupDownloadListener() {
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            runCatching {
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimetype)
                    addRequestHeader("User-Agent", userAgent)
                    setTitle(fileName)
                    setDescription("正在从 GitHub 下载：$fileName")
                    setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                    )
                    // API 29+ 不需要 WRITE_EXTERNAL_STORAGE，DownloadManager 自动处理
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    setAllowedOverMetered(true)
                    setAllowedOverRoaming(false)
                }
                val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "开始下载：$fileName", Toast.LENGTH_SHORT).show()
            }.onFailure { e ->
                Toast.makeText(this, "下载失败：${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ── 辅助方法 ────────────────────────────────────────────────────

    /**
     * 创建相机拍照 Intent。
     * 使用 FileProvider 生成 content:// URI，规避 Android 7+ 的 file:// 限制。
     */
    private fun createCameraIntent(): Intent? = runCatching {
        val imageFile = File.createTempFile("camera_capture_", ".jpg", externalCacheDir)
        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", imageFile)
        cameraImageUri = uri
        Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(android.provider.MediaStore.EXTRA_OUTPUT, uri)
        }
    }.getOrNull()

    private fun registerDownloadReceiver() {
        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(downloadReceiver, filter)
        }
    }
}
