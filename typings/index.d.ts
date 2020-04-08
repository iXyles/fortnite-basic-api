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

  export interface FortniteInputMethod {
    gamepad: FortniteMode;
    touch: FortniteMode;
    keyboardmouse: FortniteMode;
    all: FortniteMode;
  }

  export interface StatsModel {
    lifetime: FortniteInputMethod;
    season: FortniteInputMethod;
    user: LookupResult;
    error: string;
  }

  export interface LookupResult {
    id: string;
    displayName: string;
    externalAuths: ExternalAuths;
    error: string;
  }

  export interface OperationResult {
    success: boolean | string;
    error: boolean | string | any;
    errors: any[];
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
    error: string;
  }

  export interface TokenResult {
    tokenValid: boolean;
    error: string;
  }

  export class Authenticator {
    constructor (client: Client);

    client: Client;
    killHook: boolean;
    refreshing: boolean;
    expiresAt: string;
    accessToken: string;
    refreshToken: string;
    accountId: string;
    perms: string;

  
    login(): Promise<OperationResult>;
    getTokenWithDeviceAuth(): Promise<any>;
    getTokenWithLoginCreds(): Promise<any>;
    setupAutoKill(): void;
    createSessionDeviceAuth(): Promise<OperationResult>;
    createDeviceAuthWithExchange(token: string): Promise<OperationResult>;
    saveDeviceAuth(): Promise<OperationResult>;
    readDeviceAuth(): Promise<any>;
    removeDeviceAuths(): void;
    killDeviceAuths(): Promise<OperationResult>;
    getOAuthExchangeToken(token: string): Promise<any>;
    getFortniteOAuthToken(exchangeToken: string): Promise<AuthData>;
    getOAuthToken(twoStep?: boolean, method?: any, useIosToken?: boolean): Promise<any>;
    checkToken(): Promise<TokenResult>;
    updateToken(): Promise<OperationResult>;
    killCurrentSession(): Promise<OperationResult>;
    setAuthData(data: AuthData): void;
    checkEULA(data: AuthData): Promise<any>;
    acceptEULA(login: AuthData, eula: any): Promise<any>;
    purchaseFortnite(login: AuthData): Promise<boolean>;
  }

  export class Stats {
    constructor(client: Client);

    client: Client;

    getV2Stats(user: string | LookupResult): Promise<StatsModel>;
  }

  export class Presence {
    constructor(communicator: Communicator)
  
    communicator: Communicator;
  }

  export class Lookup {
    constructor(client: Client);

    client: Client;

    accountLookup(account: string | string[] | LookupResult): Promise<LookupResult | LookupResult[]>;
    lookupByUsername(username: string): Promise<LookupResult>;
    lookupByUserId(accountId: string): Promise<LookupResult>;
    lookupByUserIds(accountIds: string[]): Promise<LookupResult[] | LookupResult>;
  }

  export class Client {
    constructor(config: ClientConfig);

    authenticator: Authenticator;
    lookup: Lookup;
    stats: Stats;

    createDeviceAuthFromExchangeCode(): Promise<OperationResult>;
    getServerStatus(): Promise<boolean>;
    getBRNews(language: string): Promise<any>;
    getBRStore(): Promise<any>;
    getPVEInfo(): Promise<any>;
    getBREventFlags(): Promise<any>;
  }

  export class Friendship {
    constructor(communicator: Communicator);

    communicator: Communicator;
    client:  Client;

    addFriend(user: string): Promise<boolean>;
    removeFriend(user: string): Promise<boolean>;
    sendMessage(to: any, message: string): Promise<boolean>;
    getRawFriends(includePending: boolean): Promise<Friend[]>;
    getIncomingFriendRequests(): Promise<Friend[]>;
    getOutgoingFriendRequests(): Promise<Friend[]>;
    getFriends(): Promise<Friend[]>;
  }
 
  export class Friend {
    constructor(communicator: Communicator, data?: any);

    communicator: Communicator;
    accountId: string;
    JID: string;
    friendStatus: FriendStatus;
    status: Status;
    presence: string;
    created: any;
    favorite: boolean;
    platform: string;

    fetch(): void;
    update(data: any): void;
    getStatus(type?: string): Promise<string>;
    remove(): Promise<boolean>;
    accept(): Promise<boolean>;
    reject(): Promise<boolean>;
    sendMessage(message: string): Promise<boolean>;
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
    stream: any;

    setup(): void;
    updateConfigs(opts: any): void;
    connect(): Promise<OperationResult>;
    sendProbe(to: any): Promise<any>;
    updateStatus(status: any): Promise<any>;
    performRefreshLogin(): void;
  }
}
