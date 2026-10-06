package com.kieranaston.movierecs.ui.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.kieranaston.movierecs.ui.components.EmptyState
import com.kieranaston.movierecs.ui.components.ErrorState
import com.kieranaston.movierecs.ui.components.app
import com.kieranaston.movierecs.ui.theme.Dimens

@Composable
fun SignInScreen() {
    val app = app()
    val vm = viewModel { SignInViewModel(app.deviceAuth, app.session) }
    LaunchedEffect(Unit) { vm.start() }

    when (val s = vm.state) {
        SignInViewModel.UiState.Loading -> EmptyState("Getting a sign-in code…")
        SignInViewModel.UiState.Failed -> ErrorState(onRetry = vm::retry, message = "Couldn't start sign-in.")
        is SignInViewModel.UiState.ShowCode -> SignInContent(s.userCode, s.verificationUri, s.qrUrl, s.afterDenial)
    }
}

/** "WDJB-MJHT" — the format the website shows too. */
fun formatUserCode(code: String) = if (code.length == 8) "${code.take(4)}-${code.drop(4)}" else code

/** Pure UI so it can be previewed and UI-tested. */
@Composable
fun SignInContent(userCode: String, verificationUri: String, qrUrl: String, afterDenial: Boolean) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Row(
        Modifier.fillMaxSize().padding(horizontal = Dimens.Gutter * 2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(64.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text("Movie Recs", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(12.dp))
            Text("Sign in with your phone", style = MaterialTheme.typography.displaySmall)
            Spacer(Modifier.height(24.dp))
            if (afterDenial) {
                Text("That request was denied. Here's a new code.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(12.dp))
            }
            Text("1.  Scan the code with your phone's camera", style = MaterialTheme.typography.bodyLarge)
            Text("2.  Sign in with Google and tap Approve", style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(28.dp))
            Text("Or visit ${verificationUri.removePrefix("https://").removePrefix("http://")} and enter", style = MaterialTheme.typography.bodyMedium, color = muted)
            Spacer(Modifier.height(8.dp))
            Text(
                formatUserCode(userCode),
                style = MaterialTheme.typography.displaySmall.copy(fontFamily = FontFamily.Monospace, fontSize = 44.sp, letterSpacing = 4.sp),
                modifier = Modifier.testTag("user-code"),
            )
            Spacer(Modifier.height(16.dp))
            Text("This screen updates by itself once you approve.", style = MaterialTheme.typography.labelMedium, color = muted)
        }
        QrCode(qrUrl, size = 220.dp, modifier = Modifier.width(252.dp))
    }
}
