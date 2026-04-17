import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { SERVER_URL } from './api.js'
import { getRarity } from './constants.js'

const STYLES = {
  app: { minHeight: '100vh', background: '#0d0d0d', color: '#f0f0f0', fontFamily: 'monospace', padding: '24px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '12px' },
  input: { background: '#1a1a1a', border: '1px solid #333', color: '#f0f0f0', padding: '10px 14px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px', width: '260px' },
  btn: { background: '#f0f0f0', color: '#0d0d0d', border: 'none', padding: '10px 20px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' },
  btnDark: { background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #333', padding: '10px 20px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '14px', cursor: 'pointer' },
  error: { color: '#ff4444', fontSize: '13px' },
  panel: { background: '#111', border: '1px solid #222', borderRadius: '6px', padding: '16px', marginBottom: '16px' },
  label: { color: '#666', fontSize: '12px', marginBottom: '4px' },
  stat: { fontSize: '20px', fontWeight: 'bold' },
  rock: { width: '120px', height: '120px', background: '#222', border: '2px solid #444', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', cursor: 'pointer', userSelect: 'none', transition: 'transform 0.05s' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '600px', width: '100%' },
  log: { height: '120px', overflowY: 'auto', fontSize: '12px', color: '#888', display: 'flex', flexDirection: 'column-reverse' },
}

const NPC_PRICES = {
  coal: 1, copper_ore: 5, tin_ore: 8, raw_quartz: 20,
  iron_ore: 15, silver_ore: 40, malachite: 80, amethyst_shard: 200,
  gold_ore: 120, obsidian: 150, ruby_fragment: 300, sapphire_fragment: 600,
  platinum_ore: 400, void_stone: 800, diamond_rough: 2000,
  ancient_fragment: 1200, worldstone_shard: 15000, core_crystal: 80000,
}

function InventoryPanel({ inventory, onSell, onClose }) {
  const [sellAmounts, setSellAmounts] = useState({})
  const items = Object.entries(inventory).filter(([, q]) => q > 0)

  function handleSell(item) {
    const qty = parseInt(sellAmounts[item]) || 0
    if (qty <= 0) return
    onSell(item, qty)
    setSellAmounts(prev => ({ ...prev, [item]: '' }))
  }

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10 }} />

      {/* side panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px',
        background: '#111', borderLeft: '1px solid #222', zIndex: 11,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #222' }}>
          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Inventory</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {items.length === 0
            ? <div style={{ color: '#444', fontSize: '13px', marginTop: '12px' }}>Nothing yet — start mining</div>
            : items.map(([item, qty]) => {
              const rarity = getRarity(item)
              return (
              <div key={item} style={{ padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{item.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '13px', color: '#888' }}>{qty} &nbsp;<span style={{ color: '#444', fontSize: '11px' }}>{NPC_PRICES[item] ? `${NPC_PRICES[item]} BG ea` : ''}</span></span>
                </div>
                <div style={{ fontSize: '11px', color: rarity.color, marginBottom: '6px', fontWeight: 'bold', letterSpacing: '0.05em' }}>{rarity.label}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    min="1"
                    max={qty}
                    placeholder={`max ${qty}`}
                    value={sellAmounts[item] || ''}
                    onChange={e => setSellAmounts(prev => ({ ...prev, [item]: e.target.value }))}
                    style={{ ...STYLES.input, width: '100%', padding: '6px 10px', fontSize: '12px' }}
                  />
                  <button
                    onClick={() => handleSell(item)}
                    style={{ ...STYLES.btnDark, padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    Sell
                  </button>
                </div>
              </div>
            )})}
          }
        </div>
      </div>
    </>
  )
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('bc_token'))
  const [player, setPlayer] = useState(null)
  const [view, setView] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [rockHealth, setRockHealth] = useState(10)
  const [rockMax] = useState(10)
  const [log, setLog] = useState([])
  const [inventory, setInventory] = useState({})
  const [invOpen, setInvOpen] = useState(false)
  const socketRef = useRef(null)

  const addLog = (msg, item = null) => setLog(prev => [{ msg, item }, ...prev].slice(0, 50))

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
    const socket = io(SERVER_URL, { auth: { token: t }, transports: ['polling', 'websocket'] })
    socketRef.current = socket

    socket.on('mine_result', ({ ore, rockHealth: rh, error }) => {
      if (error) { addLog(`Error: ${error}`, null); return }
      setRockHealth(rh)
      if (ore) {
        setInventory(prev => ({ ...prev, [ore]: (prev[ore] || 0) + 1 }))
        const { label: rarityLabel } = getRarity(ore)
        const name = ore.replace(/_/g, ' ')
        addLog(`[${rarityLabel}] ${name}`, ore)
      }
    })

    socket.on('sell_result', ({ earned, bitgold, error }) => {
      if (error) { addLog(`Sell error: ${error}`); return }
      setPlayer(prev => ({ ...prev, bitgold }))
      addLog(`Sold for ${earned} BG`)
    })

    socket.on('rock_shattered', () => {
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
    if (!socketRef.current) return
    socketRef.current.emit('mine_click', { tier: 'tier0' })
  }

  function sell(item, qty) {
    if (!socketRef.current) return
    socketRef.current.emit('npc_sell', { item_type: item, quantity: qty })
    setInventory(prev => ({ ...prev, [item]: Math.max(0, (prev[item] || 0) - qty) }))
  }

  function logout() {
    localStorage.removeItem('bc_token')
    socketRef.current?.disconnect()
    setToken(null); setPlayer(null); setView('login')
  }

  if (view === 'game' && player) {
    const healthPct = Math.round((rockHealth / rockMax) * 100)
    const totalItems = Object.values(inventory).reduce((s, q) => s + q, 0)

    return (
      <div style={STYLES.app}>
        {invOpen && <InventoryPanel inventory={inventory} onSell={sell} onClose={() => setInvOpen(false)} />}

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
          <div style={STYLES.label}>Surface Rock — {healthPct}% health</div>
          <div style={{ height: '8px', background: '#222', borderRadius: '4px', margin: '8px 0 16px' }}>
            <div style={{ height: '100%', width: `${healthPct}%`, background: '#f0f0f0', borderRadius: '4px', transition: 'width 0.1s' }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={STYLES.rock}
              onClick={mine}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              🪨
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#555' }}>Click to mine</div>
              <button
                onClick={() => setInvOpen(true)}
                style={{ ...STYLES.btnDark, padding: '8px 14px', fontSize: '13px' }}
              >
                Inventory {totalItems > 0 ? `(${totalItems})` : ''}
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...STYLES.panel, maxWidth: '600px' }}>
          <div style={STYLES.label}>Activity log</div>
          <div style={STYLES.log}>
            {log.length === 0
              ? <span style={{ color: '#333' }}>No activity yet</span>
              : log.map((entry, i) => {
                  const color = entry.item ? getRarity(entry.item).color : '#888'
                  return <span key={i} style={{ color }}>{entry.msg}</span>
                })
            }
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={STYLES.center}>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '-0.03em', marginBottom: '8px' }}>⛏ BitCraft</div>
      <div style={{ color: '#666', marginBottom: '16px', fontSize: '13px' }}>{view === 'login' ? 'Sign in to your account' : 'Create your account'}</div>
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
