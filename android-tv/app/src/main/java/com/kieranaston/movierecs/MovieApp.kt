package com.kieranaston.movierecs

import android.app.Application
import android.os.Build
import androidx.core.content.edit
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import com.kieranaston.movierecs.data.Api
import com.kieranaston.movierecs.data.WatchlistRepository
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient

/** Holds the app-wide singletons. Small enough that no DI framework is needed. */
class MovieApp : Application(), SingletonImageLoader.Factory {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Shared connection pool; used as-is for TMDB images. */
    private val http by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    /** Calls to our own server identify the app, so the server logs are readable. */
    private val serverHttp by lazy {
        val userAgent = "MovieRecsTV/${BuildConfig.VERSION_NAME} (${Build.MODEL.filter { it in ' '..'~' && it !in "()" }.trim()})"
        http.newBuilder().addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("User-Agent", userAgent).build()) }.build()
    }

    private val prefs by lazy { getSharedPreferences("auth", MODE_PRIVATE) }

    /** The owner token from signing in, or null. Without it the watchlist is read-only. */
    var ownerToken: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit { if (value == null) remove("token") else putString("token", value) }

    val api by lazy { Api(BuildConfig.API_BASE_URL, serverHttp) { ownerToken } }

    val watchlist by lazy { WatchlistRepository(api, scope).also { it.refresh() } }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { http })) }
            .crossfade(true)
            .build()
}
