export type Headline = {
  title: string;
  link: string;
  date: string;
};

export type Task = {
  id: string;
  title: string;
};

export type Verse = {
  ref: string;
  text: string;
};

export type Email = {
  id: string;
  from: string;
  subject: string;
  date: string;
  link: string;
};

export type Event = {
  id: string;
  title: string;
  displayDate: string;
  displayTime: string;
  type: string;
};

export type NowPlaying = {
  connected: boolean;
  expired?: boolean;
  playing?: boolean;
  track?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  progress?: number;
  duration?: number;
  deviceName?: string;
};

export type Playlist = {
  id: string;
  name: string;
  uri: string;
  image?: string;
};

export type ApiResponse<T> = {
  success?: boolean;
  error?: string;
  data?: T;
} & T;
