<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '../config'
import { Dende, type IDendePart, DendePartType } from '../dende'
import { DrawingData } from '../proto/drawing'

const router = useRouter()
const dendeContainer = ref<HTMLElement | null>(null)
const socket = ref<WebSocket | null>(null)
const isConnected = ref(false)

// Dende Instance
let dende: Dende | null = null

// Protocol Constants
const MSG_TYPE_DRAWING = 2 // "iota const that says it's a drawing data"

// UI State
const currentColor = ref('#000000')
const currentSize = ref(5)
const currentMode = ref<'drawing' | 'filling'>('drawing')

// --- WebSocket Logic ---

const connect = () => {
  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/game/ws'
  
  socket.value = new WebSocket(wsUrl)
  socket.value.binaryType = "arraybuffer" // Important for raw bytes

  socket.value.onopen = () => {
    console.log("Connected to Game Server! 🚀")
    isConnected.value = true
  }

  socket.value.onmessage = async (event) => {
    try {
      const data = new Uint8Array(event.data)
      if (data.length === 0) return

      // 1. Check the last byte (Protocol Suffix)
      const type = data[data.length - 1]

      // 2. If it matches DrawingData (2)
      if (type === MSG_TYPE_DRAWING) {
        // 3. Decode the payload (everything except the last byte)
        const payload = data.subarray(0, data.length - 1)
        const decoded = DrawingData.decode(payload)

        // 4. Map to IDendePart
        // Note: Protobuf colors are 0-1 floats, Dende expects 0-255 for RGB
        const part: IDendePart = {
          type: decoded.type as unknown as DendePartType, // Assumes Enum alignment
          isLineEnd: decoded.isLineEnd,
          coordinates: decoded.coordinates,
          color: [
            decoded.color[0] * 255,
            decoded.color[1] * 255,
            decoded.color[2] * 255,
            decoded.color[3]
          ],
          lineWidth: decoded.lineWidth
        }

        // 5. Feed into Dende engine
        dende?.putPart(part)
      }
    } catch (err) {
      console.error("Error handling message:", err)
    }
  }

  socket.value.onclose = () => {
    isConnected.value = false
    console.log("Disconnected.")
  }
}

const sendPart = (part: IDendePart) => {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) return

  // 1. Create Protobuf Message
  const payload = DrawingData.create({
    type: part.type,
    isLineEnd: part.isLineEnd,
    coordinates: part.coordinates,
    // Convert Dende (0-255) back to Protobuf (0-1)
    color: [
      part.color[0] / 255,
      part.color[1] / 255,
      part.color[2] / 255,
      part.color[3]
    ],
    lineWidth: part.lineWidth
  })

  // 2. Encode to bytes
  const protoBytes = DrawingData.encode(payload).finish()

  // 3. Create envelope: [ ...ProtoBytes, SuffixByte ]
  const packet = new Uint8Array(protoBytes.length + 1)
  packet.set(protoBytes, 0)
  packet[protoBytes.length] = MSG_TYPE_DRAWING // Append the '2'

  // 4. Send
  socket.value.send(packet)
}

// --- Controls ---

const updateSettings = () => {
  if (!dende) return
  
  // Hex to RGB conversion for Dende
  const hex = currentColor.value
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  dende.setLineColorRGBA(r, g, b, 1)
  dende.setLineWidth(currentSize.value)
  dende.setDrawingMode(currentMode.value)
}

const undo = () => dende?.undo()
const redo = () => dende?.redo()
const clear = () => dende?.clear()

// --- Lifecycle ---

onMounted(() => {
  // Initialize Dende
  dende = new Dende(800, 600)
  
  // Attach Dende canvas to our DIV
  if (dendeContainer.value) {
    dendeContainer.value.appendChild(dende.getHTMLElement())
  }

  // Listen for local drawings and send them
  dende.onPartCreated((part) => {
    sendPart(part)
  })
  
  dende.enableDrawing()
  updateSettings() // Apply initial defaults
  
  connect()
})

onUnmounted(() => {
  socket.value?.close()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center py-8">
    <div class="mb-4 text-center">
      <h1 class="text-3xl font-bold text-gray-800">Game Room 🎮</h1>
      <p class="text-sm font-medium" :class="isConnected ? 'text-green-600' : 'text-red-500'">
        {{ isConnected ? '● Live' : '○ Connecting...' }}
      </p>
    </div>

    <div class="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-wrap gap-4 items-center justify-center">
      <div class="flex items-center gap-2">
        <input 
          type="color" 
          v-model="currentColor" 
          @change="updateSettings"
          class="h-9 w-9 cursor-pointer border-none bg-transparent rounded"
        >
      </div>
      
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-gray-500 uppercase">Size</span>
        <input 
          type="range" 
          v-model.number="currentSize" 
          @input="updateSettings" 
          min="1" max="20" 
          class="w-24 accent-blue-600"
        >
      </div>

      <div class="flex bg-gray-100 rounded-lg p-1">
        <button 
          @click="() => { currentMode = 'drawing'; updateSettings() }"
          class="px-3 py-1 text-sm font-medium rounded-md transition"
          :class="currentMode === 'drawing' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'"
        >
          Draw
        </button>
        <button 
          @click="() => { currentMode = 'filling'; updateSettings() }"
          class="px-3 py-1 text-sm font-medium rounded-md transition"
          :class="currentMode === 'filling' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'"
        >
          Fill
        </button>
      </div>

      <div class="flex gap-2 border-l pl-4 border-gray-200">
        <button @click="undo" class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Undo">↩️</button>
        <button @click="redo" class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Redo">↪️</button>
        <button @click="clear" class="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Clear Board">🗑️</button>
      </div>

      <button @click="router.push('/')" class="ml-2 text-xs font-bold text-gray-400 hover:text-red-500">
        EXIT
      </button>
    </div>

    <div 
      ref="dendeContainer" 
      class="bg-white shadow-xl rounded-lg overflow-hidden border-4 border-gray-300"
      style="line-height: 0;"
    ></div>
  </div>
</template>