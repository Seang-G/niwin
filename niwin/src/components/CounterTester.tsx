import type { ChangeEvent } from 'react'
import { useCounterStore } from '../stores/useCounterStore'

const CounterTester = () => {
  const { count, setCount } = useCounterStore()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    if (!Number.isNaN(next)) {
      setCount(next)
    }
  }

  return (
    <div className="card tester">
      <h2>Counter Tester</h2>
      <p>Use the input to push specific values into the store.</p>
      <label>
        Set count
        <input type="number" value={count} onChange={handleChange} />
      </label>
      <button onClick={() => setCount(Math.floor(Math.random() * 100))}>
        Random 0-99
      </button>
    </div>
  )
}

export default CounterTester
