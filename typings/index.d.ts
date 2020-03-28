declare module 'fortnite-basic-api' {

  interface EventEmitter extends NodeJS.EventEmitter {
  }

  export enum FriendStatus {
    NONE,
    INCOMING,
    OUTGOING,
    ACCEPTED,
    BLOCKED,
    REMOVED,
    REJECTED,
    ABORTED
  }

  export enum Status {
    NONE,
    ONLINE,
    OFFLINE,
    AWAY,
    PLAYING
  }

  export interface FortniteScore {
    matchesplayed: number;
    kills: number;
    placetop10: number;
    placetop6: number;
    placetop3: number;
    placetop1: number;
    minutesplayed: number;
    score: number;
    placetop25: number;
    lastmodified: number;
    playersoutlived: number;
    placetop12: number;
    placetop5: number;
    winrate: number;
    kdr: number;
    killsPerMatch: number;
  }
  
  export interface FortniteMode {
    highexplosives_squads: FortniteScore;
    defaultduo: FortniteScore;
    comp_solo: FortniteScore;
    blitz_squad: FortniteScore;
    defaultsolo	: FortniteScore;
    '50v50': FortniteScore;
    defaultsquad: FortniteScore;
    snipers_squad: FortniteScore;
    intro_apollo_newplayer: FortniteScore;
    close_squad: FortniteScore;
    low_duos: FortniteScore;
    deimos_duo: FortniteScore;
    showdownalt_solo: FortniteScore;
    creative_playonly: FortniteScore;
    playground: FortniteScore;
    snipers_duos: FortniteScore;
    mash_squads: FortniteScore;
    respawn_24: FortniteScore;
    solidgold_squads: FortniteScore;
    '5x20': FortniteScore;
    playgroundv2: FortniteScore;
    snipers_solo: FortniteScore;
    all: FortniteScore;
  }

  export interface AuthId {
    id: string;
    type: string;
  }

  export interface AuthPlatform {
    type: string;
    externalAuthId: string;
    accountId: string;
    externalDisplayName: string;
    authIds: AuthId[];
  }

  export interface ExternalAuths {
    psn: AuthPlatform;
    xbl: AuthPlatform;
    nintendo: AuthPlatform;
  }

  export interface User {
    id: string;
    displayName: string;
    externalAuths: ExternalAuths;
  }

  export interface FortniteInputMethod {
    gamepad: FortniteMode;
    touch: FortniteMode;
    keyboardmouse: FortniteMode;
    all: FortniteMode;
  }

  export interface StatsModel {
    lifetime: FortniteInputMethod;
    season: FortniteInputMethod;
    user: User;
    error: string;
  }

  export interface Friend {
    communicator: Communicator;
    accountId: string;
    JID: string;
    friendStatus: FriendStatus;
    status: string;
    presence: string;
    created: any;
    favorite: boolean;

    fetch(): void;
    update(data: any): void;
    getStatus(type?: any): string;
    remove(): boolean;
    accept(): boolean;
    reject(): boolean;
    sendMessage(message: string): boolean;
  }

  export interface OperationResult {
    success: boolean | string;
    error: any;
  }

  export interface ClientConfig {
    email?: string;
    password?: string;
    useDeviceAuth?: boolean;
    deviceAuthPath?: string;
    removeOldDeviceAuths?: boolean;
    launcherToken?: string;
    fortniteToken?: string;
    iosToken?: string;
    seasonStartTime?: string;
    autokill?: boolean;
  }

  export interface CommunicatorConfig {
    reconnect?: boolean;
    title?: string;
  }

  export interface AuthData {
    expires_at?: string;
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
    perms?: string;
  }

  export class Authenticator {
    constructor (client: Client);

    client: Client;
    killHook: boolean;
    refreshing: boolean;
  
    login(): OperationResult;
    getTokenWithDeviceAuth(): any;
    getTokenWithLoginCreds(): any;
    setupAutoKill(): void;
    createSessionDeviceAuth(): any;
    createDeviceAuthWithExchange(token: string): OperationResult;
    saveDeviceAuth(): OperationResult;
    readDeviceAuth(): any;
    removeDeviceAuths(): void;
    killDeviceAuths(): OperationResult;
    getOAuthExchangeToken(token: string): any;
    getFortniteOAuthToken(exchangeToken: string): any;
    getOAuthToken(twoStep: boolean, method: any, useIosToken: boolean);
    checkToken(): any;
    updateToken(): OperationResult;
    killCurrentSession(): OperationResult;
    setAuthData(data: AuthData): void;
    checkEULA(data: AuthData): any;
    acceptEULA(login: AuthData, eula: any): any;
    purchaseFortnite(login: AuthData): boolean;
  }

  export class Stats {
    constructor(client: Client);

    client: Client;

    getV2Stats(user: string | any): StatsModel;
  }

  export class Presence {
    constructor(communicator: Communicator)
  
    communicator: Communicator;
  }

  export class Client {
    constructor(config: ClientConfig);

    authenticator: Authenticator;
    stats: Stats;

    createDeviceAuthFromExchangeCode(): OperationResult;
    getServerStatus(): boolean;
    getBRNews(language: string): any;
    getBRStore(): any;
    getPVEInfo(): any;
    getBREventFlags(): any;
  }

  export class Friendship {
    constructor(communicator: Communicator);

    communicator: Communicator;
    client:  Client;

    addFriend(user: string): boolean;
    removeFriend(user: string): boolean;
    sendMessage(to: any, message: string): boolean;
    getRawFriends(includePending: boolean): Friend[];
    getIncomingFriendRequests(): Friend[];
    getOutgoingFriendRequests(): Friend[];
    getFriends(): Friend[];
  }

  export class Communicator {
    constructor(client: Client, config?: CommunicatorConfig);

    client: Client;
    events: EventEmitter;
    friendship: Friendship;

    connected: boolean;
    uuid: string;
    resource: string;
    reconnect: boolean;
    title: string;

    setup(): void;
    updateConfigs(opts: any): void;
    connect(): OperationResult;
    sendProbe(to: any): void;
    updateStatus(status: any): void;
    performRefreshLogin(): void;
  }
}
