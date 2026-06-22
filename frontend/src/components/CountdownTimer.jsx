import { useEffect, useState } from 'react'

export default function CountdownTimer({ seconds, onExpire }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) {
      onExpire()
      return
    }
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          onExpire()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, []) // intentionally empty — runs once on mount

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isUrgent = remaining <= 60

  return (
    <div className={`countdown ${isUrgent ? 'countdown-urgent' : ''}`}>
      <span className="countdown-icon">⏱</span>
      <span className="countdown-time">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      <span className="countdown-label">avant expiration</span>
    </div>
  )
}
