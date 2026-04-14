from flask import Flask, jsonify
from flask_cors import CORS
import hid
import struct
import math
import re

app = Flask(__name__)
CORS(app)

# In-memory order database for tracking shipping orders
ORDERS_DB = {
    '12345': {
        'order_id': '12345',
        'status': 'in_transit',
        'estimated_delivery_date': '2024-02-15'
    },
    '67890': {
        'order_id': '67890',
        'status': 'shipped',
        'estimated_delivery_date': '2024-02-20'
    },
    '11111': {
        'order_id': '11111',
        'status': 'delivered',
        'estimated_delivery_date': '2024-02-10'
    },
    '54321': {
        'order_id': '54321',
        'status': 'pending',
        'estimated_delivery_date': None
    }
}

def find_dymo_scale():
    for device in hid.enumerate():
        if "DYMO" in (device.get("manufacturer_string") or ""):
            return device["vendor_id"], device["product_id"]
    return None, None

def read_weight():
    vid, pid = find_dymo_scale()
    if not vid:
        print("✗ DYMO scale not found.")
        return 0, 0

    try:
        scale = hid.device()
        scale.open(vid, pid)
        scale.set_nonblocking(0)

        for _ in range(10):
            data = scale.read(6)
            print("📦 Raw data:", data)
            if data and data[2] == 11:  # lb/oz
                raw_weight = data[4] + (data[5] << 8)
                exponent = struct.unpack("b", bytes([data[3]]))[0]  # signed 8-bit int
                weight = raw_weight * (10 ** exponent)

                print(f"🧮 Raw={raw_weight}, Exp={exponent}, OZ={weight}")
                lb = int(weight) // 16
                oz = math.ceil(weight % 16)
                print(f"✓ Final weight: {lb} lb {oz} oz")
                return lb, oz

    except Exception as e:
        print("✗ Error reading DYMO scale:", e)

    return 0, 0

@app.route('/weight')
def get_weight():
    lb, oz = read_weight()
    return jsonify({"weight_lb": lb, "weight_oz": oz})

if __name__ == "__main__":
    app.run(port=5000)
