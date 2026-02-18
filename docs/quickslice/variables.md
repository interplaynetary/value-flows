Variables
GraphQL variables parameterize queries and mutations for reusability and security.

#Basic Variables
#Query with Variables
query GetStatusByEmoji($emoji: String!) {
xyzStatusphereStatus(where: {
status: { eq: $emoji }
}) {
edges {
node {
uri
status
createdAt
}
}
}
}
Variables:

{
"emoji": "🎉"
}
#Mutation with Variables
mutation CreateStatus($statusEmoji: String!, $timestamp: String!) {
createXyzStatusphereStatus(
input: {
status: $statusEmoji
createdAt: $timestamp
}
) {
uri
status
createdAt
}
}
Variables:

{
"statusEmoji": "🚀",
"timestamp": "2025-01-30T12:00:00Z"
}
#Multiple Variables
query GetFilteredStatuses(
$emoji: String!
$pageSize: Int!
$cursor: String
) {
xyzStatusphereStatus(
where: { status: { eq: $emoji } }
first: $pageSize
after: $cursor
sortBy: [{ field: createdAt, direction: DESC }]
) {
edges {
node {
uri
status
createdAt
}
cursor
}
pageInfo {
hasNextPage
endCursor
}
totalCount
}
}
Variables:

{
"emoji": "✨",
"pageSize": 10,
"cursor": null
}
#Optional Variables
Use default values for optional variables:

query GetProfiles(
$name: String = ""
$pageSize: Int = 20
) {
appBskyActorProfile(
where: { displayName: { contains: $name } }
first: $pageSize
) {
edges {
node {
displayName
description
}
}
}
}
Variables:

{
"name": "alice"
}
Or omit variables to use defaults:

{}
#Blob Upload with Variables
mutation UploadImage($imageData: String!, $type: String!) {
uploadBlob(
data: $imageData
mimeType: $type
) {
ref
mimeType
size
}
}
Variables:

{
"imageData": "base64EncodedImageData...",
"type": "image/jpeg"
}
#Update Profile with Variables
mutation UpdateProfile(
$name: String!
$bio: String!
$avatarRef: String!
$avatarType: String!
$avatarSize: Int!
) {
updateAppBskyActorProfile(
rkey: "self"
input: {
displayName: $name
description: $bio
avatar: {
ref: $avatarRef
mimeType: $avatarType
size: $avatarSize
}
}
) {
uri
displayName
description
avatar {
ref
url(preset: "avatar")
}
}
}
Variables:

{
"name": "Alice Smith",
"bio": "Software engineer & designer",
"avatarRef": "bafkreiabc123...",
"avatarType": "image/jpeg",
"avatarSize": 125000
}
#Using in HTTP Requests
Send variables in the HTTP request body:

curl -X POST http://localhost:8080/graphql \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer <token>" \
 -d '{
"query": "query GetStatus($emoji: String!) { xyzStatusphereStatus(where: { status: { eq: $emoji } }) { edges { node { status } } } }",
"variables": {
"emoji": "🎉"
}
}'
