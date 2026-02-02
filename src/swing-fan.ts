import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { MELCloudHomePlatform } from './platform';
import { AirToAirUnit, MELCloudAPI } from './melcloud-api';

/**
 * Swing Fan - A virtual fan device for controlling AC swing mode
 *
 * Similar to Home Assistant template fan:
 * - Active: AC is powered on AND swing mode is "Swing"
 * - Inactive: AC is off OR swing mode is not "Swing" (Auto)
 * - Has 1 speed (no percentage control)
 * - Turn on: Sets swing mode to "Swing"
 * - Turn off: Sets swing mode to "Auto"
 */
export class SwingFan {
  private service: Service;
  private device: AirToAirUnit;

  constructor(
    private readonly platform: MELCloudHomePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Mitsubishi Electric')
      .setCharacteristic(this.platform.Characteristic.Model, 'MELCloud Swing Control')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.device.connectedInterfaceIdentifier}-swing-control`);

    // Get or create the Fan service (Fanv2)
    this.service = this.accessory.getService(this.platform.Service.Fanv2) ||
      this.accessory.addService(this.platform.Service.Fanv2);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      `${this.device.givenDisplayName} Swing`,
    );

    // Active (on/off)
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Note: We don't set up RotationSpeed for swing fan as it only has 1 speed (on/off)
    // This makes it behave like a simple on/off fan in Home app
  }

  private getSettings() {
    return MELCloudAPI.parseSettings(this.device.settings);
  }

  private normalizeVane(vane: string): string {
    const normalized = vane.toLowerCase();
    if (normalized === '0' || normalized === 'auto') {
      return 'auto';
    }
    if (normalized === '6' || normalized === 'six' || normalized === '7' || normalized === 'swing') {
      return 'swing';
    }
    return normalized;
  }

  async getActive(): Promise<CharacteristicValue> {
    const settings = this.getSettings();
    const isPowerOn = settings.Power === 'True';
    const vaneMode = this.normalizeVane(settings.VaneVerticalDirection);
    const isSwing = vaneMode === 'swing';

    // Active = AC is on AND vane is in Swing mode
    const isActive = isPowerOn && isSwing;
    
    this.platform.debugLog(
      `[${this.device.givenDisplayName} Swing] Get Active: ${isActive} (power=${isPowerOn}, vane=${settings.VaneVerticalDirection})`,
    );
    
    return isActive ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    const isActive = value === this.platform.Characteristic.Active.ACTIVE;
    
    this.platform.log.info(`[${this.device.givenDisplayName} Swing] Set Active: ${isActive}`);

    if (isActive) {
      // Turn on: Set swing mode to Swing
      await this.setVanePosition('Swing');
    } else {
      // Turn off: Set swing mode to Auto
      await this.setVanePosition('Auto');
    }
  }

  private async setVanePosition(vaneDirection: string) {
    const settings = this.getSettings();

    this.platform.log.info(
      `[${this.device.givenDisplayName} Swing] Setting vaneVerticalDirection=${vaneDirection}`,
    );

    try {
      await this.platform.getAPI().controlDevice(this.device.id, {
        power: settings.Power === 'True',
        operationMode: settings.OperationMode,
        setFanSpeed: settings.SetFanSpeed,
        vaneHorizontalDirection: settings.VaneHorizontalDirection,
        vaneVerticalDirection: vaneDirection,
        setTemperature: Number.parseFloat(settings.SetTemperature),
        temperatureIncrementOverride: null,
        inStandbyMode: null,
      });

      // Update cached state
      const updatedSettings = this.device.settings.map(setting => {
        if (setting.name === 'VaneVerticalDirection') {
          return { ...setting, value: vaneDirection };
        }
        return setting;
      });
      this.device.settings = updatedSettings;

      // Update this fan's state immediately
      this.updateFromDevice(this.device);

      // Schedule a full refresh to sync with API
      this.platform.scheduleRefresh();
    } catch (error) {
      this.platform.log.error(`[${this.device.givenDisplayName} Swing] Failed to set position:`, error);
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
      );
    }
  }

  // Update from device state (called by platform refresh)
  public updateFromDevice(device: AirToAirUnit) {
    this.device = device;
    this.accessory.context.device = device;

    const settings = this.getSettings();
    const isPowerOn = settings.Power === 'True';
    const vaneMode = this.normalizeVane(settings.VaneVerticalDirection);
    const isSwing = vaneMode === 'swing';
    const isActive = isPowerOn && isSwing;

    // Update Active state
    const currentActive = this.service.getCharacteristic(this.platform.Characteristic.Active).value;
    const targetActive = isActive 
      ? this.platform.Characteristic.Active.ACTIVE 
      : this.platform.Characteristic.Active.INACTIVE;
    
    if (targetActive !== currentActive) {
      this.platform.debugLog(
        `[${this.device.givenDisplayName} Swing] Update Active: ${currentActive} -> ${targetActive}`,
      );
      this.service.updateCharacteristic(this.platform.Characteristic.Active, targetActive);
    }
  }
}
