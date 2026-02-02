# Homebridge MELCloud Home

[![npm version](https://img.shields.io/npm/v/homebridge-melcloud-home.svg)](https://www.npmjs.com/package/homebridge-melcloud-home)
[![npm downloads](https://img.shields.io/npm/dt/homebridge-melcloud-home.svg)](https://www.npmjs.com/package/homebridge-melcloud-home)

Homebridge plugin for Mitsubishi Electric Air Conditioners using the **MELCloud Home** platform (melcloudhome.com).

## Background

I needed a way to control my Mitsubishi AC units through HomeKit, but the existing MELCloud plugins only worked with the old MELCloud platform (app.melcloud.com). My units use the newer MELCloud Home platform (melcloudhome.com), which has a completely different API.

So I created this plugin with the help of [Claude Code](https://claude.com/claude-code).

## Support This Project

☕ [Buy Me a Coffee](https://buymeacoffee.com/eehnsio)

## Credits

This project is a fork of [homebridge-melcloud-home](https://github.com/eehnsio/homebridge-melcloud-home) by [eehnsio](https://github.com/eehnsio).

Thanks to [homebridge-melcloud-control](https://github.com/grzegorz914/homebridge-melcloud-control) for inspiration on the Homebridge integration patterns.

## Features

- Power on/off
- Temperature control (including 0.5° increments)
- Mode switching (Heat, Cool, Auto)
- Fan speed control (Auto + 5 speed levels)
- **Swing mode control** - oscillate vanes with native HomeKit toggle
- Real-time temperature monitoring
- Automatic device discovery
- **Separate fan speed tile** (optional) - quick access to fan speed as separate HomeKit accessory
- **Long-lived sessions** - authenticate once, automatic token refresh keeps you connected
- **Lightweight & always responsive** - no browser dependencies or periodic re-authentication delays
- Homebridge v1 & v2 compatible

## Important: MELCloud vs MELCloud Home

This plugin is **only** for MELCloud Home (melcloudhome.com). If you use the original MELCloud (app.melcloud.com), you need a different plugin like [homebridge-melcloud-control](https://github.com/grzegorz914/homebridge-melcloud-control).

Not sure which one you have? Check which website you log into - if it's melcloudhome.com, you're in the right place.

## Installation

### Via Homebridge UI

1. Search for `homebridge-melcloud-home` in the Homebridge plugins tab
2. Click Install
3. Click Settings (gear icon) after installation
4. Enter your MELCloud email and password in Step 1
5. Click "Login and Get Token" - your token will be obtained automatically
6. Click "Save Token" in Step 2
7. Restart Homebridge

### Via npm

```bash
npm install -g homebridge-melcloud-home
```

## Setup

1. Install the plugin via Homebridge UI
2. Click the **Settings** button (⚙️)
3. **Step 1:** Enter your MELCloud email and password, then click "Login and Get Token"
4. **Step 2:** Your token will appear automatically - click "Save Token"
5. **Step 3:** Configure settings (refresh interval, debug mode, etc.) - they save automatically
6. Restart Homebridge

Your devices will appear in HomeKit automatically!

### Authentication

The plugin uses OAuth for secure authentication:
- Your credentials are sent directly to MELCloud's servers (never stored by the plugin)
- A refresh token is saved in your Homebridge config
- The token is automatically refreshed when needed (no re-authentication required)
- Works in all browsers (Safari, Chrome, Firefox, Edge)

### Configuration

All settings can be configured through the custom UI - click the Settings (⚙️) button on the plugin.

| Setting | Description | Default |
|---------|-------------|---------|
| `refreshInterval` | How often to check device status (seconds). With 30-second polling, changes from the MELCloud app or remote control are picked up quickly. Configurable from 10-3600 seconds. | 30 |
| `debug` | Enable detailed logging for troubleshooting. Shows all refresh data, API calls, and state changes without requiring Homebridge debug mode. | false |
| `exposeTemperatureSensor` | Add a separate temperature sensor for each AC unit that can be used in HomeKit automations. | true |
| `fanSpeedButtons` | Create separate switch buttons for fan speed control (none, simple, all). Simple creates Auto/Quiet/Max buttons, All creates Auto/1/2/3/4/5 buttons. Each button shows its speed clearly (e.g. 'Bedroom Fan Auto'). | none |
| `fanSpeedControl` | Create a virtual fan device for fan speed control. Fan shows Off when AC is off or fan is in Auto mode. Fan speed is controlled via percentage (0%=Auto, 20%=1, 40%=2, 60%=3, 80%=4, 100%=5). Similar to Home Assistant template fan. | none |
| `vaneControl` | Control vane/swing position (none, buttons, fan). 'buttons' creates separate Auto and Swing switches. 'fan' creates a virtual fan that turns on/off swing mode. | none |
| `swingControl` | Additional swing control option. Creates a separate virtual fan device for swing control (can be used together with vaneControl=buttons if you want both). | none |

### Fan Speed & Swing Control Options

The plugin offers multiple ways to control fan speed and swing mode:

#### Traditional Buttons (Legacy)
- `fanSpeedButtons: "simple"` - Creates Auto, Quiet, Max switches
- `fanSpeedButtons: "all"` - Creates Auto, 1, 2, 3, 4, 5 switches
- `vaneControl: "buttons"` - Creates Auto and Swing switches

#### Virtual Fan Devices (Recommended)
- `fanSpeedControl: "fan"` - Creates a virtual fan device for speed control
  - Fan is **OFF** when AC is off or fan mode is Auto
  - Fan is **ON** when fan is manually set to speeds 1-5
  - Speed controlled via percentage: 0%=Auto, 20%=Speed 1, 40%=Speed 2, 60%=Speed 3, 80%=Speed 4, 100%=Speed 5
  - Turn ON sets fan to max speed (5)
  - Turn OFF sets fan to Auto
  
- `vaneControl: "fan"` or `swingControl: "fan"` - Creates a virtual fan device for swing control
  - Fan is **OFF** when AC is off or swing mode is not active
  - Fan is **ON** when swing mode is active
  - Turn ON activates swing mode
  - Turn OFF deactivates swing mode (sets to Auto)

**Why virtual fans?** This approach matches Home Assistant's template fan behavior and provides more intuitive control in HomeKit. The fan tiles integrate better with HomeKit automations and scenes compared to individual switches.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

## License

Apache-2.0

## Issues & Contributions

Found a bug? Have an idea? [Open an issue](https://github.com/eehnsio/homebridge-melcloud-home/issues) on GitHub.
