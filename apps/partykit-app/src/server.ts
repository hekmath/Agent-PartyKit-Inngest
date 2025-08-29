import type * as Party from 'partykit/server';

export default class Main implements Party.Server {
  static async onBeforeRequest(req: Party.Request) {
    return req;
  }

  static async onBeforeConnect(req: Party.Request) {
    return req;
  }

  static async onFetch(req: Party.Request) {
    return new Response('Unrecognized request: ' + req.url, { status: 404 });
  }

  readonly options: Party.ServerOptions = {
    hibernate: true,
  };

  readonly party: Party.Room;

  constructor(party: Party.Room) {
    this.party = party;
  }

  async onStart() {}

  async onRequest(req: Party.Request) {
    if (req.method === 'POST') {
      try {
        // Expect an envelope: { requestId: string, body: UIMessageChunk | any }
        const messageBody: { requestId?: string; body: unknown } =
          await req.json();

        console.log(`📨 Room ${this.party.id} received:`, {
          requestId: messageBody.requestId,
          summary:
            typeof messageBody.body === 'string'
              ? (messageBody.body as string).slice(0, 60) + '...'
              : (messageBody.body as any)?.type
              ? `chunk:${(messageBody.body as any).type}`
              : 'object',
        });

        // Broadcast the full envelope so clients can filter by requestId
        this.party.broadcast(JSON.stringify(messageBody));

        console.log(
          `📡 Room ${this.party.id} broadcasted to ${
            [...this.party.getConnections()].length
          } connections`
        );

        return new Response(
          JSON.stringify({
            success: true,
            room: this.party.id,
            connections: [...this.party.getConnections()].length,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        console.error('❌ Error processing request:', error);
        return new Response('Invalid request body', { status: 400 });
      }
    }

    // GET request - return room info
    return new Response(
      JSON.stringify({
        room: this.party.id,
        messages: 0,
        connections: [...this.party.getConnections()].length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  async onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(
      `✅ Connection ${connection.id} connected to room ${this.party.id}`
    );

    // Send a welcome message to the new connection
    connection.send(
      JSON.stringify({
        type: 'welcome',
        room: this.party.id,
        connectionId: connection.id,
      })
    );
  }

  async onMessage(message: string, connection: Party.Connection) {
    // No client->server control msgs required now (cancel happens via HTTP)
    console.log(
      `📩 Message from ${connection.id} in room ${this.party.id}:`,
      message
    );
    try {
      const data = JSON.parse(message);
      console.log('Parsed message:', data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  async onError(connection: Party.Connection, err: Error) {
    console.log(
      `❌ Error from ${connection.id} in room ${this.party.id}:`,
      err.message
    );
  }

  async onClose(connection: Party.Connection) {
    console.log(
      `👋 Connection ${connection.id} closed in room ${this.party.id}`
    );
  }
}

Main satisfies Party.Worker;
