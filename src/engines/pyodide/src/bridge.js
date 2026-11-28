import { Peripherals, BOARDS } from './peripherals.js';

let peripherals = new Peripherals('pi4');

// Every method is intentionally small and synchronous: Python calls cross the
// JS boundary on each peripheral access, so the shim stays thin.
export const bridge = {
  boards() { return Object.keys(BOARDS); },
  reset(board) { peripherals.reset(board || peripherals.board); return peripherals.board; },
  board() { return peripherals.board; },

  gpio_setup(pin, mode, pull) { return peripherals.gpioSetup(pin, mode, pull); },
  gpio_write(pin, value) { return peripherals.gpioWrite(pin, value); },
  gpio_read(pin) { return peripherals.gpioRead(pin); },
  gpio_drive(pin, level) { return peripherals.gpioDrive(pin, level); },
  gpio_release(pin) { return peripherals.gpioRelease(pin); },
  gpio_edges(pin, edge, after) { return peripherals.gpioEdges(pin, edge, after); },
  gpio_event_count(pin, edge) { return peripherals.gpioEventCount(pin, edge); },
  gpio_drive_voltage(pin, volts) { return peripherals.gpioDriveVoltage(pin, volts); },
  gpio_voltage(pin) { return peripherals.gpioVoltage(pin); },
  adc_read_noisy(channel) { return peripherals.adcReadNoisy(channel); },
  pwm_voltage(pin) { return peripherals.pwmVoltage(pin); },
  pwm_average_voltage(pin, windowMs) { return peripherals.pwmAverageVoltage(pin, windowMs); },
  electrical_set_capacitance(pin, pf) { return peripherals.electricalSetCapacitance(pin, pf); },
  electrical_settled_voltage(pin) { return peripherals.settledVoltage(pin); },
  electrical_overcurrent(pin) { return peripherals.overCurrent(pin); },
  electrical_settle() { return peripherals.settleElectrical(); },
  generation() { return peripherals.generation; },
  edge_count() { return peripherals.edgeCount(); },
  edges_since(after) { return peripherals.edgesSince(after); },

  i2c_write(bus, addr, bytes) { return peripherals.i2cWrite(bus, addr, bytes); },
  i2c_read(bus, addr, count) { return peripherals.i2cRead(bus, addr, count); },
  i2c_attach(bus, addr, device) { return peripherals.i2cAttach(bus, addr, device); },
  i2c_attach_regfile(bus, addr, kind, length, initial) { return peripherals.i2cAttachRegFile(bus, addr, kind, length, initial); },
  i2c_has(bus, addr) { return peripherals.i2cHas(bus, addr); },

  spi_xfer(bus, dev, bytes) { return peripherals.spiXfer(bus, dev, bytes); },
  spi_attach(bus, dev, device) { return peripherals.spiAttach(bus, dev, device); },
  spi_attach_regfile(bus, dev, kind, length, initial) { return peripherals.spiAttachRegFile(bus, dev, kind, length, initial); },

  pwm_create(pin, frequency) { return peripherals.pwmCreate(pin, frequency); },
  pwm_duty(pin, duty) { return peripherals.pwmDuty(pin, duty); },
  pwm_stop(pin) { return peripherals.pwmStop(pin); },
  pwm_frequency(pin, hz) { return peripherals.pwmFrequency(pin, hz); },

  adc_set(channel, value) { return peripherals.adcSet(channel, value); },
  adc_read(channel) { return peripherals.adcRead(channel); },

  uart_write(text) { return peripherals.uartWrite(text); },
  uart_inject(text) { return peripherals.uartInject(text); },
  uart_read(size) { return peripherals.uartRead(size); },
  uart_read_line() { return peripherals.uartReadLine(); },

  clock_ms() { return peripherals.clockNow(); },
  clock_set(ms) { return peripherals.clockSet(ms); },
  sleep(ms) { return peripherals.sleep(ms); },

  cpu_temp() { return peripherals.cpuTemp(); },
  cpu_temp_set(celsius) { return peripherals.cpuTempSet(celsius); },
  led_write(name, on) { return peripherals.ledWrite(name, on); },
  led_read(name) { return peripherals.ledRead(name); },

  onewire_set(pin, celsius) { return peripherals.onewireSet(pin, celsius); },
  onewire_read(pin) { return peripherals.onewireRead(pin); },
  onewire_reset(pin) { return peripherals.onewireReset(pin); },
  onewire_write_byte(pin, byte) { return peripherals.onewireWriteByte(pin, byte); },
  onewire_read_byte(pin) { return peripherals.onewireReadByte(pin); },
  onewire_busy(pin) { return peripherals.onewireBusy(pin); },
  dht_waveform(pin) { return peripherals.dhtWaveform(pin); },
  hcsr04_measure(trigger, echo) { return peripherals.hcsr04Measure(trigger, echo); },
  env_set(values) { return peripherals.envSet(values); },
  env_get() { return JSON.stringify(peripherals.envGet()); },
  dht_set(pin, celsius, humidity) { return peripherals.dhtSet(pin, celsius, humidity); },
  dht_read(pin) { return peripherals.dhtRead(pin); },

  neopixel_setup(pin, count) { return peripherals.neopixelSetup(pin, count); },
  neopixel_set(pin, index, r, g, b) { return peripherals.neopixelSet(pin, index, r, g, b); },
  neopixel_fill(pin, r, g, b) { return peripherals.neopixelFill(pin, r, g, b); },
  lcd_create(name, cols, rows) { return peripherals.lcdCreate(name, cols, rows); },
  lcd_write(name, text) { return peripherals.lcdWrite(name, text); },
  lcd_clear(name) { return peripherals.lcdClear(name); },

  camera_configure(width, height) { return peripherals.cameraConfigure(width, height); },
  camera_capture() { return peripherals.cameraCapture(); },

  analog_reset() { return peripherals.analogReset(); },
  analog_set_timestep(us) { return peripherals.analogSetTimestep(us); },
  analog_node(name) { return peripherals.analog.node(name); },
  analog_add(type, name, a, b, value, extra) { return peripherals.analog.add(type, name, a, b, value, extra || {}); },
  analog_set(name, value) { return peripherals.analog.set(name, value); },
  analog_remove(name) { return peripherals.analog.remove(name); },
  analog_solve(dtUs) { peripherals.analogSolve(dtUs); },
  analog_voltage(name) { return peripherals.analogVoltage(name); },
  analog_current(name) { return peripherals.analogCurrent(name); },
  analog_charge(name) { return peripherals.analogCharge(name); },
  analog_kcl() { return JSON.stringify(peripherals.analogKcl()); },
  analog_has_node(name) { return peripherals.analogHasNode(name); },
  analog_rail_current() { return peripherals.analogRailCurrent(); },
  analog_pin_current(pin) { return peripherals.analogPinCurrent(pin); },
  analog_trace(target, durationMs, dtUs) {
    return JSON.stringify(peripherals.analogTrace(target, durationMs, dtUs));
  },
  analog_summary() { return JSON.stringify(peripherals.analogSummary()); },
  analog_attach_pin(pin) { return peripherals.analogAttachPin(pin); },
  analog_attach_adc(channel, node) { return peripherals.analogAttachAdc(channel, node); },
  adc_solved(channel) { return peripherals.adcSolved(channel); },
  adc_solved16(channel) { return peripherals.adcSolved16(channel); },

  config_get() { return peripherals.configGet(); },
  config_set(key, value) { return peripherals.configSet(key, value); },
  apply_overlay(name) { return peripherals.applyOverlay(name); },
  config_text() { return peripherals.configText(); },
  dev_nodes() { return peripherals.devNodes(); },
  device_tree() { return peripherals.deviceTree(); },

  net_interfaces() { return peripherals.netInterfaces(); },
  net_register_service(name, port) { return peripherals.netRegisterService(name, port); },
  net_register_route(port, path, body) { return peripherals.netRegisterRoute(port, path, body); },
  net_http_request(method, url) { return peripherals.netHttpRequest(method, url); },
  net_mqtt_subscribe(topic) { return peripherals.netMqttSubscribe(topic); },
  net_mqtt_publish(topic, payload, qos) { return peripherals.netMqttPublish(topic, payload, qos); },
  net_mqtt_messages(topic) { return peripherals.netMqttMessages(topic); },
  net_dns_resolve(name) { return peripherals.netDnsResolve(name); },
  net_socket_open(kind) { return peripherals.netSocketOpen(kind); },
  net_socket_bind(id, port) { return peripherals.netSocketBind(id, port); },
  net_socket_listen(id) { return peripherals.netSocketListen(id); },
  net_socket_connect(id, host, port) { return peripherals.netSocketConnect(id, host, port); },
  net_socket_accept(id) { return peripherals.netSocketAccept(id); },
  net_socket_send(id, data) { return peripherals.netSocketSend(id, data); },
  net_socket_recv(id, size) { return peripherals.netSocketRecv(id, size); },
  net_socket_close(id) { return peripherals.netSocketClose(id); },
  net_socket_state(id) { return peripherals.netSocketState(id); },
  net_retransmit(conn) { return peripherals.netRetransmit(conn); },
  net_datagram_send(id, host, port, data) { return peripherals.netDatagramSend(id, host, port, data); },
  net_datagram_recv(id) { return peripherals.netDatagramRecv(id); },
  net_serve_pending(port) { return peripherals.netServePending(port); },
  net_packet_log() { return peripherals.netPacketLog(); },

  state() { return peripherals.state(); },
};

if (typeof window !== 'undefined') window.__rpiBridge = bridge;

export function getPeripherals() { return peripherals; }
export default bridge;
