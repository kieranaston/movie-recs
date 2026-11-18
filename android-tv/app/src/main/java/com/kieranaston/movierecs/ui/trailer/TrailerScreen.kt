package com.kieranaston.movierecs.ui.trailer

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import kotlinx.coroutines.delay

private val YouTubeKey = Regex("^[A-Za-z0-9_-]{6,20}$")

fun isYouTubeKey(key: String) = YouTubeKey.matches(key)

/**
 * Plays a YouTube trailer full screen inside the app (YouTube's embedded player in a WebView).
 * OK / play-pause toggles playback, left/right seek 10s, Back leaves. A small label confirms
 * pause and seek. Playback pauses when the app goes to the background. When the video ends it
 * returns to the movie; if the video can't be embedded it opens in the YouTube app instead.
 */
@Composable
fun TrailerScreen(key: String, onDone: () -> Unit) {
    val onDoneNow by rememberUpdatedState(onDone)
    val finished = remember { mutableStateOf(false) }
    val done = { if (!finished.value) { finished.value = true; onDoneNow() } } // ended + unplayable can both fire
    val focus = remember { FocusRequester() }
    val web = remember { mutableStateOf<WebView?>(null) }
    var paused by remember { mutableStateOf(false) }
    var seekHint by remember { mutableStateOf<Pair<String, Long>?>(null) } // label + press time, so repeats restart the timer

    LaunchedEffect(seekHint) {
        if (seekHint != null) { delay(SEEK_HINT_MS); seekHint = null }
    }

    // Stop sound and decoding when the app is backgrounded; resume the page (not the video) when it returns.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, web.value) {
        val view = web.value
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> { view?.evaluateJavascript("try{player.pauseVideo()}catch(e){}", null); view?.onPause() }
                Lifecycle.Event.ON_RESUME -> view?.onResume()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer) }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(focus)
            .focusable()
            .onKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown) return@onKeyEvent false
                val js = when (e.key) {
                    Key.DirectionCenter, Key.Enter, Key.NumPadEnter, Key.MediaPlayPause, Key.Spacebar -> "toggle()"
                    Key.MediaPlay -> "player.playVideo()"
                    Key.MediaPause -> "player.pauseVideo()"
                    Key.DirectionLeft, Key.MediaRewind -> "seek(-10)"
                    Key.DirectionRight, Key.MediaFastForward -> "seek(10)"
                    else -> return@onKeyEvent false
                }
                if (js.startsWith("seek")) seekHint = (if (js == "seek(-10)") "◀◀ 10s" else "10s ▶▶") to System.nanoTime()
                web.value?.evaluateJavascript("try{$js}catch(e){}", null)
                true
            },
    ) {
        if (isYouTubeKey(key)) {
            AndroidView(
                factory = { ctx ->
                    trailerWebView(
                        ctx, key,
                        onEnded = { done() },
                        onUnplayable = { openInYouTube(ctx, key); done() },
                        onPlaying = { paused = !it },
                    ).also { web.value = it }
                },
                onRelease = { it.destroy(); web.value = null },
                modifier = Modifier.fillMaxSize(),
            )
        }
        val label = seekHint?.first ?: if (paused) "❚❚ Paused" else null
        if (label != null) {
            Text(
                label,
                style = MaterialTheme.typography.titleMedium,
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.Center)
                    .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 20.dp, vertical = 10.dp),
            )
        }
    }
    LaunchedEffect(Unit) {
        if (!isYouTubeKey(key)) done() // only ever build a player from a well-formed video id
        else runCatching { focus.requestFocus() }
    }
}

private const val SEEK_HINT_MS = 900L

@SuppressLint("SetJavaScriptEnabled")
private fun trailerWebView(
    context: Context,
    key: String,
    onEnded: () -> Unit,
    onUnplayable: () -> Unit,
    onPlaying: (Boolean) -> Unit,
): WebView {
    val main = Handler(Looper.getMainLooper())
    // One CSS pixel = one screen pixel. Android TVs usually report a 960×540 CSS viewport on a 1080p
    // screen, and YouTube picks the stream quality from the player's CSS size, so it would stay near 540p.
    val scale = 1f / context.resources.displayMetrics.density
    return WebView(context).apply {
        // Remote keys go to the Compose box around this view, which drives the player.
        isFocusable = false
        isFocusableInTouchMode = false
        keepScreenOn = true
        setBackgroundColor(android.graphics.Color.BLACK)
        settings.javaScriptEnabled = true
        settings.useWideViewPort = true // honour the viewport scale below
        settings.mediaPlaybackRequiresUserGesture = false // autoplay with sound
        webChromeClient = WebChromeClient()
        addJavascriptInterface(
            object {
                @JavascriptInterface fun ended() { main.post(onEnded) }
                @JavascriptInterface fun unplayable() { main.post(onUnplayable) }
                @JavascriptInterface fun playing(p: Boolean) { main.post { onPlaying(p) } }
            },
            "Trailer",
        )
        // YouTube's embed refuses to play without an identifiable https origin (error 153),
        // so the page is given the website's address; nothing is loaded from it.
        loadDataWithBaseURL(EMBED_ORIGIN, playerHtml(key, scale), "text/html", "utf-8", null)
    }
}

private const val EMBED_ORIGIN = "https://mrecs.vercel.app/"

/**
 * Full-screen IFrame player, sized in pixels: sized with CSS percentages it plays sound over a
 * black screen on Android TV. Errors 101/150 (embedding disabled) and 153 fall back to the YouTube app.
 * YouTube no longer lets apps choose the quality (setPlaybackQuality is unsupported); it picks one
 * from the player's size and the connection, so the player is given the full screen's pixel size.
 */
private fun playerHtml(key: String, scale: Float) = """
<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=$scale,minimum-scale=$scale,maximum-scale=$scale">
<style>body{margin:0;background:#000;overflow:hidden}</style>
</head><body><div id="p"></div>
<script>
var player;
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{videoId:'$key',width:innerWidth||960,height:innerHeight||540,
    playerVars:{autoplay:1,controls:1,rel:0,playsinline:1,iv_load_policy:3,fs:0,origin:'${EMBED_ORIGIN.trimEnd('/')}'},
    events:{
      onReady:function(e){e.target.playVideo()},
      onStateChange:function(e){
        if(e.data===YT.PlayerState.ENDED)Trailer.ended();
        else if(e.data===YT.PlayerState.PLAYING)Trailer.playing(true);
        else if(e.data===YT.PlayerState.PAUSED)Trailer.playing(false);
      },
      onError:function(e){if([2,5].indexOf(e.data)<0)Trailer.unplayable()}
    }});
}
addEventListener('resize',function(){if(player&&player.setSize&&innerWidth)player.setSize(innerWidth,innerHeight)});
// Buffering counts as playing: pressing OK mid-buffer must pause, not "play" a video that is already starting.
function toggle(){var s=player.getPlayerState();(s===YT.PlayerState.PLAYING||s===YT.PlayerState.BUFFERING)?player.pauseVideo():player.playVideo()}
function seek(d){player.seekTo(Math.max(0,player.getCurrentTime()+d),true)}
</script>
<script src="https://www.youtube.com/iframe_api"></script>
</body></html>
"""

/** YouTube for Android TV, then any YouTube app, then anything that handles the web URL. */
fun openInYouTube(context: Context, key: String) {
    if (!isYouTubeKey(key)) return
    val watch = "https://www.youtube.com/watch?v=$key".toUri()
    val intents = listOf(
        Intent(Intent.ACTION_VIEW, watch).setPackage("com.google.android.youtube.tv"),
        Intent(Intent.ACTION_VIEW, "vnd.youtube:$key".toUri()),
        Intent(Intent.ACTION_VIEW, watch),
    )
    for (intent in intents) {
        try {
            context.startActivity(intent)
            return
        } catch (_: ActivityNotFoundException) {
            // try the next option
        }
    }
    Toast.makeText(context, "Couldn't play this trailer", Toast.LENGTH_SHORT).show()
}
