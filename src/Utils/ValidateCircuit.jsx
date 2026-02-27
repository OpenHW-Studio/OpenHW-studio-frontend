export function validateCircuit(components, wires) {
  const errors = []

  // Check LED has a resistor in series
  const leds = components.filter(c => c.type === 'wokwi-led')
  const resistors = components.filter(c => c.type === 'wokwi-resistor')

  leds.forEach(led => {
    const ledPins = [`${led.id}:A`, `${led.id}:K`]
    const connectedToResistor = wires.some(w =>
      (ledPins.includes(w.from) || ledPins.includes(w.to)) &&
      resistors.some(r => w.from.startsWith(r.id) || w.to.startsWith(r.id))
    )
    if (!connectedToResistor && wires.some(w => ledPins.includes(w.from) || ledPins.includes(w.to))) {
      errors.push({ type: 'error', message: `LED "${led.id}" has no current-limiting resistor! Will burn out.`, compIds: [led.id] })
    }
  })

  // Check for unconnected power pins on buzzer/servo
  const buzzers = components.filter(c => c.type === 'wokwi-buzzer')
  buzzers.forEach(b => {
    const connected = wires.some(w => w.from.startsWith(b.id) || w.to.startsWith(b.id))
    if (!connected) {
      errors.push({ type: 'warning', message: `Buzzer "${b.id}" is not connected to anything.`, compIds: [b.id] })
    }
  })

  // Duplicate wire check
  const seen = new Set()
  wires.forEach(w => {
    const key = [w.from, w.to].sort().join('--')
    if (seen.has(key)) {
      errors.push({ type: 'warning', message: `Duplicate wire between ${w.from} and ${w.to}.`, compIds: [] })
    }
    seen.add(key)
  })

  return errors
}