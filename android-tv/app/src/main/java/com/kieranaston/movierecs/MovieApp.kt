package com.kieranaston.movierecs

import android.app.Application
import android.os.Build
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import com.kieranaston.movierecs.data.Api
import com.kieranaston.movierecs.data.HttpDeviceAuth
import com.kieranaston.movierecs.data.KeystoreTokenStorage
import com.kieranaston.movierecs.data.SessionRepository
import com.kieranaston.movierecs.data.WatchlistRepository
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
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

    /** Calls to our own server identify the app, so the website's device list can label this TV. */
    private val serverHttp by lazy {
        val userAgent = "MovieRecsTV/${BuildConfig.VERSION_NAME} (${Build.MODEL.filter { it in ' '..'~' && it !in "()" }.trim()})"
        http.newBuilder().addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("User-Agent", userAgent).build()) }.build()
    }

    val deviceAuth by lazy { HttpDeviceAuth(BuildConfig.API_BASE_URL, serverHttp) }

    val session by lazy { SessionRepository(KeystoreTokenStorage(this), deviceAuth, scope) }

    val api by lazy { Api(BuildConfig.API_BASE_URL, serverHttp, token = { session.currentToken() }, onUnauthorized = { session.onUnauthorized() }) }

    val watchlist by lazy {
        WatchlistRepository(api, scope).also { repo ->
            scope.launch {
                session.state.collect {
                    if (it is SessionRepository.State.SignedIn) repo.refresh() else repo.reset()
                }
            }
        }
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(OkHttpNetworkFetcherFactory(callFactory = { http })) }
            .crossfade(true)
            .build()
}
