import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { SERVER_URL } from './api.js'

const STYLES = {
  app: { minHeight: '100vh', background: '#0d0d0d', color: '#f0f0f0', fontFamily: 'monospace', padding: '24px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '12px' },
  input: { background: '#1a1a1a', border: '1px solid #333', color: '#f0f0f0', padding: '10px 14px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px', width: '260px' },
  btn: { background: '#f0f0f0', color: '#0d0d0d', border: 'none', padding: '10px 20px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' },
  btnDark: { background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #333', padding: '10px 20px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px', cursor: 'pointer' },
  title: { fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '-0.03em', marginBottom: '8px' },
  sub: { color: '#666', marginBottom: '16px', fontSize: '13px' },
  error: { color: '#ff4444', fontSize: '13px' },
  panel: { background: '#111', border: '1px solid #222', borderRadius: '6px', padding: '16px', marginBottom: '16px' },
  label: { color: '#666', fontSize: '12px', marginBottom: '4px' },
  stat: { fontSize: '20px', fontWeight: 'bold' },
  rock: { width: '120px', height: '120px', background: '#222', border: '2px solid #444', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', cursor: 'pointer', userSelect: 'none', transition: 'transform 0.05s' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px', width: '100%' },
  log: { height: '120px', overflowY: 'auto', fontSize: '12px', color: '#888', display: 'flex', flexDirection: 'column-reverse' },
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('bc_token'))
  const [player, setPlayer] = useState(null)
  const [view, setView] = useState('login') // login | register | game
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [rockHealth, setRockHealth] = useState(10)
  const [rockMax] = useState(10)
  const [respawning, setRespawning] = useState(false)
  const [log, setLog] = useState([])
  const [inventory, setInventory] = useState({})
  const socketRef = useRef(null)

  const addLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 50))

  useEffect(() => {
    if (token) loadPlayer(token)
  }, [])

  async function loadPlayer(t) {
    try {
      const res = await fetch(`${SERVER_URL}/player/me`, {
        headers: { Authorization: `Bearer ${t}` }
      })
      if (!res.ok) { localStorage.removeItem('bc_token'); setToken(null); return }
      const data = await res.json()
      setPlayer(data)
      const inv = {}
      data.inventory.forEach(i => { inv[i.item_type] = parseInt(i.quantity) })
      setInventory(inv)
      setView('game')
      connectSocket(t, data)
    } catch { setView('login') }
  }

  function connectSocket(t, p) {
    if (socketRef.current) socketRef.current.disconnect()
    const socket = io(SERVER_URL, { auth: { token: t } })
    socketRef.current = socket

    socket.on('mine_result', ({ ore, rockHealth: rh, error, respawnAt }) => {
      if (error) { addLog(`Error: ${error}`); return }
      setRockHealth(rh)
      if (ore) {
        setInventory(prev => ({ ...prev, [ore]: (prev[ore] || 0) + 1 }))
        addLog(`Found: ${ore.replace(/_/g, ' ')}`)
      }
      if (respawnAt) {
        setRespawning(true)
        const ms = respawnAt - Date.now()
        setTimeout(() => setRespawning(false), Math.max(ms, 0))
      }
    })

    socket.on('sell_result', ({ earned, bitgold, error }) => {
      if (error) { addLog(`Sell error: ${error}`); return }
      setPlayer(prev => ({ ...prev, bitgold }))
      addLog(`Sold for ${earned} BG`)
    })

    socket.on('rock_shattered', ({ tier }) => {
      setRockHealth(0)
      addLog('Rock shattered!')
    })
  }

  async function submit(endpoint) {
    setError('')
    try {
      const res = await fetch(`${SERVER_URL}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      localStorage.setItem('bc_token', data.token)
      setToken(data.token)
      loadPlayer(data.token)
    } catch { setError('Cannot reach server') }
  }

  function mine() {
    if (!socketRef.current || respawning) return
    socketRef.current.emit('mine_click', { tier: 'tier0' })
  }

  function sellAll() {
    if (!socketRef.current) return
    Object.entries(inventory).forEach(([item, qty]) => {
      if (qty > 0) socketRef.current.emit('npc_sell', { item_type: item, quantity: qty })
    })
  }

  function logout() {
    localStorage.removeItem('bc_token')
    socketRef.current?.disconnect()
    setToken(null); setPlayer(null); setView('login')
  }

  if (view === 'game' && player) {
    const healthPct = Math.round((rockHealth / rockMax) * 100)
    return (
      <div style={STYLES.app}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>⛏ BitCraft</span>
          <span style={{ color: '#666', fontSize: '13px' }}>{player.username} &nbsp;
            <button onClick={logout} style={{ ...STYLES.btnDark, padding: '4px 10px', fontSize: '12px' }}>logout</button>
          </span>
        </div>

        <div style={STYLES.grid}>
          <div style={STYLES.panel}>
            <div style={STYLES.label}>BitGold</div>
            <div style={STYLES.stat}>{parseInt(player.bitgold).toLocaleString()} BG</div>
          </div>
          <div style={STYLES.panel}>
            <div style={STYLES.label}>Pickaxe</div>
            <div style={STYLES.stat}>{player.pickaxe}</div>
          </div>
        </div>

        <div style={{ ...STYLES.panel, maxWidth: '600px' }}>
          <div style={STYLES.label}>Surface Rock — {respawning ? 'respawning...' : `${healthPct}% health`}</div>
          <div style={{ height: '8px', background: '#222', borderRadius: '4px', margin: '8px 0 16px' }}>
            <div style={{ height: '100%', width: `${healthPct}%`, background: respawning ? '#444' : '#f0f0f0', borderRadius: '4px', transition: 'width 0.1s' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{ ...STYLES.rock, opacity: respawning ? 0.4 : 1 }}
              onClick={mine}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {respawning ? '💤' : '🪨'}
            </div>
            <div style={{ fontSize: '12px', color: '#555' }}>
              {respawning ? 'Waiting for respawn...' : 'Click to mine'}
            </div>
          </div>
        </div>

        <div style={{ ...STYLES.panel, maxWidth: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={STYLES.label}>Inventory</div>
            <button onClick={sellAll} style={{ ...STYLES.btnDark, padding: '4px 10px', fontSize: '12px' }}>Sell all (NPC)</button>
          </div>
          {Object.keys(inventory).length === 0
            ? <div style={{ color: '#444', fontSize: '13px' }}>Nothing yet — start mining</div>
            : Object.entries(inventory).filter(([, q]) => q > 0).map(([item, qty]) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <span>{item.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#888' }}>{qty}</span>
                </div>
              ))
          }
        </div>

        <div style={{ ...STYLES.panel, maxWidth: '600px' }}>
          <div style={STYLES.label}>Activity log</div>
          <div style={STYLES.log}>
            {log.length === 0
              ? <span style={{ color: '#333' }}>No activity yet</span>
              : log.map((l, i) => <span key={i}>{l}</span>)
            }
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={STYLES.center}>
      <div style={STYLES.title}>⛏ BitCraft</div>
      <div style={STYLES.sub}>{view === 'login' ? 'Sign in to your account' : 'Create your account'}</div>
      <input style={STYLES.input} placeholder="username" value={username} onChange={e => setUsername(e.target.value)} />
      <input style={STYLES.input} type="password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit(view === 'login' ? 'login' : 'register')} />
      {error && <div style={STYLES.error}>{error}</div>}
      <button style={STYLES.btn} onClick={() => submit(view === 'login' ? 'login' : 'register')}>
        {view === 'login' ? 'Login' : 'Register'}
      </button>
      <button style={{ ...STYLES.btnDark, marginTop: '4px' }} onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError('') }}>
        {view === 'login' ? 'No account? Register' : 'Have an account? Login'}
      </button>
    </div>
  )
}
