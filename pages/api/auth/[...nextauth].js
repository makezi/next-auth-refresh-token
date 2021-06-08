import NextAuth from "@mtt/next-auth"
import Providers from "@mtt/next-auth/providers"
import axios from 'axios'

async function refreshAccessToken(token) {
  const { refreshToken } = token
  if (!refreshToken) {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
  try {
    console.log('ATTEMPTING TO REFRESH ACCESS TOKEN!!');

    const params = new URLSearchParams();
    params.append('client_id', 'interactive.public.short');
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token',token.refreshToken )

    const response = await axios.post('https://demo.identityserver.io/connect/token', params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      }
    })

    const refreshedTokens = response.data;
    console.log('refreshedTokens', refreshedTokens);

    const updatedToken = {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    }
    delete updatedToken.error
    return updatedToken
  } catch (error) {
    console.error('REFRESH ACCESS TOKEN ERROR');
    console.error('error status: ', error.response.status);
    console.error('error data: ', error.response.data);

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export default NextAuth({
  providers: [
    Providers.IdentityServer4({
      id: 'demo',
      name: 'demo',
      type: 'oauth',
      version: '2.0',
      scope: 'openid profile email api offline_access',
      domain: 'demo.identityserver.io',
      clientId: 'interactive.public.short',
      protection: 'pkce'
    })
  ],
  
  secret: process.env.SECRET,
  jwt: {
    secret: process.env.JWT_SECRET,
    encryption: true
  },
  callbacks: {
    async session(session, token) {
      console.log('session', session);
      console.log('token', token);
      const updatedSession = {
        ...session,
      }
      if (token?.error) {
        updatedSession.error = token.error
      }
      return updatedSession
    },
    async jwt(token, user, account, profile) {
      // Initial sign in
      if (account && user && profile) {
        const tokenWithCredentials = {
          ...token,
        }
        if (account.access_token) {
          tokenWithCredentials.accessToken = account.access_token
        }
        if (account.refresh_token) {
          tokenWithCredentials.refreshToken = account.refresh_token
        }
        if (account.expires_in) {
          tokenWithCredentials.expiresAt =
            Date.now() + account.expires_in * 1000
        }
        return tokenWithCredentials
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < token.expiresAt) {
        return token
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token)
    },
  },
  session: {
    jwt: true
  }
})
