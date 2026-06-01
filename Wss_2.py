import asyncio
import websockets
import json
import urllib.request
import urllib.error

BASEURL = "http://localhost:5002/micro"
SOLAR_URL = f"{BASEURL}/solar"
GENSET_URL = f"{BASEURL}/genset"

def post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        return None

async def send_periodically(websocket):
    data_1 = {
        "source": "python",
        "status": {
            "start_stop": 0,
            "auto_manual": 2,
            "breakeropen_close": 3,
            "reset": 0
        },

    }
    
    while True:
        await asyncio.sleep(0.5)
        post_json(SOLAR_URL, data_1)
        post_json(GENSET_URL, data_1)
        await websocket.send(json.dumps(data_1))
        print("Sent message")
        print(data_1)
        print("----->>><<<-----")
        await asyncio.sleep(1)

async def receive_forever(websocket):
    try:
        while True:
            print("----->>><<<-----RRRRR")
            msg = await websocket.recv()
            print("Received:", msg)
            print("----->>><<<-----RRRRR")
    except websockets.ConnectionClosed:
        print("Connection closed by server")

async def websocket_handler():
    uri = "ws://localhost:5002"
    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket server")

        await send_periodically(websocket)

        # Start sending and receiving in parallel
        send_task = asyncio.create_task(send_periodically(websocket))
        receive_task = asyncio.create_task(receive_forever(websocket))

        # Wait until one of them finishes (or crashes)
        await asyncio.gather(send_task, receive_task)
        await asyncio.gather(receive_task)

asyncio.run(websocket_handler())
