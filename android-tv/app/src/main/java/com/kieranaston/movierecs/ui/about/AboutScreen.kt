package com.kieranaston.movierecs.ui.about

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.tv.material3.Button
import com.kieranaston.movierecs.ui.components.app
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.kieranaston.movierecs.BuildConfig
import com.kieranaston.movierecs.R
import com.kieranaston.movierecs.ui.theme.Dimens

/** Attribution required by the TMDB API terms (and IMDb for the ratings). */
@Composable
fun AboutScreen() {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column(Modifier.padding(start = Dimens.Gutter, top = 32.dp).width(640.dp)) {
        OwnerSignIn()
        Spacer(Modifier.height(32.dp))
        Image(painterResource(R.drawable.tmdb_logo), contentDescription = "The Movie Database (TMDB)", modifier = Modifier.height(28.dp))
        Spacer(Modifier.height(24.dp))
        Text(
            "This product uses the TMDB API but is not endorsed or certified by TMDB.",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(8.dp))
        Text("Movie data and images are provided by The Movie Database (themoviedb.org).", style = MaterialTheme.typography.bodyMedium, color = muted)
        Spacer(Modifier.height(8.dp))
        Text("Ratings information courtesy of IMDb (imdb.com). Used with permission.", style = MaterialTheme.typography.bodyMedium, color = muted)
        Spacer(Modifier.height(8.dp))
        Text("Inter typeface © The Inter Project Authors, SIL Open Font License 1.1.", style = MaterialTheme.typography.bodyMedium, color = muted)
        Spacer(Modifier.height(40.dp))
        Text("Movie Recs ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.labelMedium, color = muted)
    }
}

/** Sign in once so this TV can change the watchlist; the token is remembered on the device. */
@Composable
private fun OwnerSignIn() {
    val app = app()
    val scope = rememberCoroutineScope()
    var signedIn by remember { mutableStateOf(app.ownerToken != null) }
    var password by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(28.dp)

    if (signedIn) {
        Text("Signed in — you can change the watchlist.", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(12.dp))
        Button(onClick = { app.ownerToken = null; signedIn = false; message = null }) { Text("Sign out") }
        return
    }

    Text("Owner sign-in", style = MaterialTheme.typography.titleMedium)
    Spacer(Modifier.height(4.dp))
    Text("Needed to change the watchlist. Browsing works without it.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(12.dp))
    BasicTextField(
        value = password,
        onValueChange = { password = it },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        textStyle = MaterialTheme.typography.titleMedium.copy(color = Color.White),
        cursorBrush = SolidColor(Color.White),
        modifier = Modifier
            .width(360.dp)
            .background(MaterialTheme.colorScheme.surface, shape)
            .border(BorderStroke(2.dp, if (focused) Color.White else Color.Transparent), shape)
            .padding(horizontal = 20.dp, vertical = 12.dp)
            .onFocusChanged { focused = it.isFocused },
        decorationBox = { inner ->
            if (password.isEmpty()) Text("Password", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            inner()
        },
    )
    Spacer(Modifier.height(12.dp))
    Button(onClick = {
        scope.launch {
            message = try {
                app.ownerToken = app.api.login(password)
                app.watchlist.refresh()
                signedIn = true
                password = ""
                null
            } catch (e: kotlin.coroutines.cancellation.CancellationException) {
                throw e
            } catch (e: com.kieranaston.movierecs.data.ApiException) {
                if (e.code == 401) "Wrong password." else "Couldn't sign in (error ${e.code})."
            } catch (_: Exception) {
                "Couldn't reach the server."
            }
        }
    }) { Text("Sign in") }
    message?.let {
        Spacer(Modifier.height(8.dp))
        Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
    }
}
