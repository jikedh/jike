import { app } from "electron";
import Store from "electron-store";
import ElectronStore from "electron-store";
import { ipcMainService } from "../ipcManager";

/**
 * electron-store 本地数据存储
 * 简单的键值对存储，无需加密
 */

// 默认数据
const defaultData: { [key: string]: any } = {
  userInfo: {
    username: "admin",
    password: "123456",
  },
  phone: "123456789",
};

class AppStore {
  store: Store;

  _initStore() {
    this.store = new ElectronStore({
      name: "app",
      cwd: app.getPath("userData"),
    });

    // 初始化默认值写入存储
    for (const key in defaultData) {
      if (!this.store.has(key)) {
        this.set(key, defaultData[key]);
      }
    }
  }

  /**
   * 存储数据
   * @param key 键值
   * @param value 对象（设置对象时增量修改）
   */
  public set(key: string, value: any): void {
    const originValue = this.get(key);
    let tempValue = value;
    // 合并对象
    if (
      typeof originValue === "object" &&
      originValue !== null &&
      typeof value === "object" &&
      value !== null
    ) {
      tempValue = Object.assign({}, originValue, value);
    }
    this.store.set(key, tempValue);
  }

  /**
   * 读取数据
   * @param key 键值
   */
  public get(key: string): any {
    return this.store.get(key);
  }

  /**
   * 删除数据
   * @param key 键值
   */
  public delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * 获取全部数据
   */
  public getAll() {
    return this.store.store;
  }

  registerModule(): void {
    this._initStore();

    // 存储数据
    ipcMainService.on("app:dbStore:set", (event, { key, value }) => {
      console.log("value: ", key, value);
      this.set(key, value);
    });

    // 读取数据
    ipcMainService.handle("app:dbStore:get", (event, { key }) => {
      return this.get(key);
    });

    // 读取全部数据
    ipcMainService.handle("app:dbStore:getAll", (event) => {
      return this.getAll();
    });

    // 删除数据
    ipcMainService.handle("app:dbStore:delete", (event, { key }) => {
      this.delete(key);
      return { success: true };
    });

    // 重置数据
    ipcMainService.handle("app:dbStore:reset", (event, { key }) => {
      if (key && defaultData[key]) {
        this.set(key, defaultData[key]);
      }
      return { success: true };
    });
  }
}

export const appStore = new AppStore();
