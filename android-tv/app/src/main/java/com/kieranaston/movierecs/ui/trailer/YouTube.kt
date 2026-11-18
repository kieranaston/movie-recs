package com.kieranaston.movierecs.ui.trailer

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.net.toUri

private val YouTubeKey = Regex("^[A-Za-z0-9_-]{6,20}$")

fun isYouTubeKey(key: String) = YouTubeKey.matches(key)

/**
 * Plays a trailer in the YouTube app, which brings its own remote controls and picks the quality.
 * Tries YouTube for Android TV, then any YouTube app, then anything that handles the web URL.
 */
fun openInYouTube(context: Context, key: String) {
    if (!isYouTubeKey(key)) return // only ever build a link from a well-formed video id
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
