Programmatic access
For scripts or applications that need to authenticate programmatically, you'll need to implement the AT Protocol OAuth flow against your AIP instance. This involves:

Registering an OAuth client with AIP
Redirecting the user to AIP's authorization endpoint
Exchanging the authorization code for an access token
Using that token with HappyView
See the AIP documentation for endpoint details and the ATProto OAuth spec for the full protocol.
