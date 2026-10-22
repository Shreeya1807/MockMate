import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
export default function MediaPanel({ iceServers = [], joinRoom }) {
  const local = useRef(null),
    remote = useRef(null),
    resources = useRef({}),
    alive = useRef(true)
  const [active, setActive] = useState(false),
    [starting, setStarting] = useState(false),
    [status, setStatus] = useState('Camera is off'),
    [invite, setInvite] = useState('')
  function stop() {
    const r = resources.current
    r.socket?.disconnect()
    r.pc?.close()
    r.stream?.getTracks().forEach((t) => t.stop())
    resources.current = {}
    if (local.current) local.current.srcObject = null
    if (remote.current) remote.current.srcObject = null
  }
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      stop()
    }
  }, [])
  async function start(peer = false) {
    if (starting || active) return
    setStarting(true)
    setStatus('Requesting camera permission…')
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera requires HTTPS or localhost.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: peer })
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      resources.current.stream = stream
      local.current.srcObject = stream
      setActive(true)
      setStatus(peer ? 'Connecting to interview room…' : 'Camera preview · stays on your device')
      if (!peer) return
      const pc = new RTCPeerConnection({ iceServers }),
        socket = io({ autoConnect: false, transports: ['websocket'], reconnection: false }),
        candidates = []
      Object.assign(resources.current, { pc, socket })
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))
      pc.ontrack = (e) => {
        if (remote.current) remote.current.srcObject = e.streams[0]
      }
      pc.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit('signal', { type: 'candidate', candidate: e.candidate.toJSON() })
      }
      pc.onconnectionstatechange = () =>
        setStatus(
          `Peer connection: ${pc.connectionState}${pc.connectionState === 'failed' ? ' — TURN may be required. Leave and reconnect.' : ''}`,
        )
      socket.on('connect', () =>
        socket.emit(joinRoom ? 'join' : 'create', ...(joinRoom ? [joinRoom] : []), (response) => {
          if (response.error) {
            setStatus(response.error)
            stop()
            setActive(false)
            return
          }
          if (response.room) setInvite(`${location.origin}/?room=${response.room}`)
          setStatus(
            joinRoom
              ? 'Waiting for host video…'
              : 'Invite ready · waiting for your practice partner',
          )
        }),
      )
      socket.on('peer-ready', async () => {
        try {
          await pc.setLocalDescription(await pc.createOffer())
          socket.emit('signal', { type: 'offer', sdp: pc.localDescription })
        } catch {
          setStatus('Could not start video. Leave and reconnect.')
        }
      })
      socket.on('signal', async (data) => {
        try {
          if (data.type === 'candidate') {
            if (pc.remoteDescription) await pc.addIceCandidate(data.candidate)
            else candidates.push(data.candidate)
          } else {
            await pc.setRemoteDescription(data.sdp)
            for (const c of candidates.splice(0)) await pc.addIceCandidate(c)
            if (data.type === 'offer') {
              await pc.setLocalDescription(await pc.createAnswer())
              socket.emit('signal', { type: 'answer', sdp: pc.localDescription })
            }
          }
        } catch {
          setStatus('Video negotiation failed. Leave and reconnect.')
        }
      })
      socket.on('peer-left', () =>
        setStatus('Your partner left. Leave and create a new room to reconnect.'),
      )
      socket.on('connect_error', () =>
        setStatus('Room connection failed. Check the server and configured origin.'),
      )
      socket.on('disconnect', () => setStatus('Room disconnected. Leave and reconnect.'))
      socket.connect()
    } catch (e) {
      stop()
      setActive(false)
      setStatus(e.message || 'Camera or microphone permission was denied.')
    } finally {
      if (alive.current) setStarting(false)
    }
  }
  return (
    <section className="card media-panel">
      <div className="video-grid">
        <div>
          <video ref={local} autoPlay muted playsInline />
          <span>You</span>
        </div>
        <div>
          <video ref={remote} autoPlay playsInline />
          <span>Practice partner</span>
        </div>
      </div>
      <p role="status" className="hint">
        {status}
      </p>
      <div className="actions">
        {active ? (
          <button
            onClick={() => {
              stop()
              setActive(false)
              setInvite('')
              setStatus('Camera is off')
            }}
          >
            Leave / stop camera
          </button>
        ) : (
          <>
            {!joinRoom && <button onClick={() => start(false)}>Camera preview</button>}
            <button onClick={() => start(true)}>
              {joinRoom ? 'Join video interview' : 'Invite a practice partner'}
            </button>
          </>
        )}
      </div>
      {invite && (
        <label className="invite">
          Private video invite
          <input readOnly value={invite} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <p className="hint">
        Video is not recorded or analyzed. Joining shares your microphone and camera with your
        partner. Cross-network calls may need a configured TURN server.
      </p>
    </section>
  )
}
