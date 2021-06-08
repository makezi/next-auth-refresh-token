import axios from 'axios';
import jwt from '@mtt/next-auth/jwt';

async function getAccessToken(req, res) {
  const { accessToken } = await jwt.getToken({
    req,
    secret: process.env.JWT_SECRET,
    encryption: true
  });
  return accessToken;
}

export default async (req, res) => {
  try {
    const accessToken = await getAccessToken(req, res);

    const { data } = await axios.get(
      'https://demo.identityserver.io/api/test',
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    res.status(200).json(data);
  } catch (error) {
    console.log('error', error);
    res.status(error.response.status || 500).json(error);
  }
};
