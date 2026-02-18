Subscriptions
Subscriptions deliver real-time updates when records are created, updated, or deleted. The server pushes events over WebSocket instead of requiring polling.

Connect to /graphql using the graphql-ws protocol.

#Basic Subscription
subscription {
xyzStatusphereStatusCreated {
uri
status
createdAt
}
}
#Field Selection
Request only the fields you need:

subscription {
xyzStatusphereStatusCreated {
status
}
}
Response:

{
"data": {
"xyzStatusphereStatusCreated": {
"status": "🚀"
}
}
}
#Named Subscription
subscription OnNewStatus {
xyzStatusphereStatusCreated {
uri
status
actorHandle
}
}
#Subscription Types
Each collection has three subscription fields:

{collection}Created - Fires when a new record is created
{collection}Updated - Fires when a record is updated
{collection}Deleted - Fires when a record is deleted
#Examples

# New status created

subscription {
xyzStatusphereStatusCreated {
uri
status
}
}

# Status updated

subscription {
xyzStatusphereStatusUpdated {
uri
status
}
}

# Status deleted

subscription {
xyzStatusphereStatusDeleted {
uri
}
}
#With Joins
Subscriptions support joins like queries:

subscription {
xyzStatusphereStatusCreated {
uri
status
appBskyActorProfileByDid {
displayName
avatar {
url
}
}
}
}
Response:

{
"data": {
"xyzStatusphereStatusCreated": {
"uri": "at://did:plc:abc123/xyz.statusphere.status/3m4vk4wi",
"status": "🎉 Just shipped!",
"appBskyActorProfileByDid": {
"displayName": "Alice",
"avatar": {
"url": "https://cdn.bsky.app/img/avatar/plain/did:plc:abc123/bafyrei..."
}
}
}
}
}
#WebSocket Protocol
#1. Connect
ws://localhost:8080/graphql # Local development
wss://quickslice.example.com/graphql # Production
#2. Initialize
{
"type": "connection_init"
}
#3. Subscribe
{
"id": "1",
"type": "subscribe",
"payload": {
"query": "subscription { xyzStatusphereStatusCreated { uri status } }"
}
}
#4. Receive Events
{
"id": "1",
"type": "next",
"payload": {
"data": {
"xyzStatusphereStatusCreated": {
"uri": "at://...",
"status": "Hello!"
}
}
}
}
#5. Unsubscribe
{
"id": "1",
"type": "complete"
}
