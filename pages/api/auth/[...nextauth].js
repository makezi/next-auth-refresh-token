import NextAuth from "next-auth"
import Providers from "next-auth/providers"
import axios from 'axios'

function formatDate(date) {
  const options = {
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
    timeZone: 'America/Los_Angeles'
  };

  return new Intl.DateTimeFormat('en-us', options).format(new Date(date))
}

async function refreshAccessToken(token) {
  try {
    console.log('----------------------');
    console.log('ATTEMPTING TO REFRESH ACCESS TOKEN!!');
    const formData = [
      'client_id=interactive.public.short',
      'grant_type=refresh_token',
      `refresh_token=${token.refreshToken}`
    ];

    const { data: refreshedTokens } = await axios.post(
      'https://demo.identityserver.io/connect/token',
      formData.join('&'),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    console.log('refreshedTokens', refreshedTokens);


    const newAccessTokenExpires = Date.now() + refreshedTokens.expires_in * 1000;
    const newToken = {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: newAccessTokenExpires,
      // Fall back to old refresh token
      refreshToken: refreshedTokens.refresh_token || token.refreshToken
    }
    console.log('newToken', newToken);
    console.log('new access token expires: ', newAccessTokenExpires, formatDate(newAccessTokenExpires));
    console.log('----------------------');

    return newToken;
  } catch (error) {
    console.log('----------------------');
    console.error('REFRESH ACCESS TOKEN ERROR');
    console.error('error status: ', error.response.status);
    console.error('error data: ', error.response.data);
    console.log('----------------------');

    return {
      ...token,
      error: 'RefreshAccessTokenError'
    };
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
    jwt: async (token, user, account, profile) => {
      // Initial sign in
      if (account && user) {
        return {
          accessToken: account.accessToken,
          accessTokenExpires: Date.now() + account.expires_in * 1000,
          refreshToken: account.refresh_token,
          user
        };
      }
      
      // Return previous token if the access token has not expired yet
      console.log('----------------------');
      console.log("CHECKING TOKEN IN JWT");
      console.log('token', token);
      console.log('Date.now()', Date.now(), formatDate(new Date(Date.now())));
      console.log('token.accessTokenExpires', token.accessTokenExpires, formatDate(new Date(token.accessTokenExpires)));
      console.log(
        'Date.now() < token.accessTokenExpires?',
        Date.now() < token.accessTokenExpires
      );

      if (Date.now() < token.accessTokenExpires) {
        console.log('ACCESS TOKEN STILL VALID!');
        return token;
      }
      console.log('----------------------');

      // Access token has expired, try to update it
      return await refreshAccessToken(token);
    },
    session: async (session, token) => {
      console.log('----------------------');
      console.log('CHECKING TOKEN FROM SESSION');
      console.log('token', token);
      if (token) {
        session.user = token.user;
        session.error = token.error;
      }
      console.log('----------------------');
      return session;
    }
  },

  // Enable debug messages in the console if you are having problems
  debug: false,
})
