-- Split Log schema + starter season (Concept 2 logbook columns)
create table if not exists workouts (
  id            serial primary key,
  source_key    text not null unique,
  session_date  date not null,
  description   text not null default '',
  work_seconds  integer not null default 0,
  distance_m    integer not null default 0,
  stroke_rate   integer,
  split_seconds numeric,
  watts         integer,
  calories      integer,
  avg_hr        integer,
  notes         text not null default '',
  source        text not null default 'sheet',
  created_at    timestamptz not null default now()
);
create index if not exists workouts_session_date_idx on workouts (session_date desc);

create table if not exists log_settings (
  id               integer primary key check (id = 1),
  sheet_file_id    text,
  sheet_name       text not null default 'Split Log — Concept 2',
  reminder_days    integer not null default 3,
  reminder_enabled boolean not null default true,
  last_synced_at   timestamptz,
  last_nudge_at    timestamptz
);
insert into log_settings (id) values (1) on conflict (id) do nothing;

insert into workouts (
  source_key, session_date, description, work_seconds, distance_m,
  stroke_rate, split_seconds, watts, calories, avg_hr, notes, source
) values
  ('sheet:2026-06-16:5,000m:5000', '2026-06-16', '5,000m', 1284, 5000, 22, 128.4, 165, 342, 154, 'First week back', 'sheet'),
  ('sheet:2026-06-17:45 min steady:9940', '2026-06-17', '45 min steady', 2708, 9940, 18, 136.2, 139, 644, 138, 'UT2', 'sheet'),
  ('sheet:2026-06-19:8x500m/1:00r:4000', '2026-06-19', '8x500m/1:00r', 982, 4000, 26, 122.8, 189, 288, 162, 'Rate 26', 'sheet'),
  ('sheet:2026-06-21:10,000m:10000', '2026-06-21', '10,000m', 2692, 10000, 20, 134.6, 144, 655, 142, 'Long aerobic', 'sheet'),
  ('sheet:2026-06-23:Just Row:6200', '2026-06-23', 'Just Row', 1637, 6200, 20, 132, 152, 413, 146, '', 'sheet'),
  ('sheet:2026-06-25:4x1,000m/2:00r:4000', '2026-06-25', '4x1,000m/2:00r', 997, 4000, 24, 124.6, 181, 284, 160, 'Even splits', 'sheet'),
  ('sheet:2026-06-27:60 min steady:13280', '2026-06-27', '60 min steady', 3599, 13280, 18, 135.5, 141, 864, 136, 'Podcast row', 'sheet'),
  ('sheet:2026-06-30:5,000m:5000', '2026-06-30', '5,000m', 1268, 5000, 22, 126.8, 172, 348, 156, 'Faster than last 5k', 'sheet'),
  ('sheet:2026-07-02:30r20:8380', '2026-07-02', '30r20', 2160, 8380, 20, 128.9, 163, 571, 150, 'Rate cap 20', 'sheet'),
  ('sheet:2026-07-04:10x1:00/1:00r:2750', '2026-07-04', '10x1:00/1:00r', 660, 2750, 28, 120, 203, 204, 166, 'Hard', 'sheet'),
  ('sheet:2026-07-05:10,000m:10000', '2026-07-05', '10,000m', 2664, 10000, 20, 133.2, 148, 660, 140, '', 'sheet'),
  ('sheet:2026-07-07:Just Row:4500', '2026-07-07', 'Just Row', 1183, 4500, 20, 131.4, 154, 301, 144, 'Short on time', 'sheet'),
  ('sheet:2026-07-09:3x2,000m/3:00r:6000', '2026-07-09', '3x2,000m/3:00r', 1486, 6000, 24, 123.8, 184, 428, 161, 'Pieces felt heavy', 'sheet'),
  ('sheet:2026-07-11:45 min steady:10120', '2026-07-11', '45 min steady', 2708, 10120, 18, 133.8, 146, 665, 137, 'UT2', 'sheet'),
  ('sheet:2026-07-13:5,000m:5000', '2026-07-13', '5,000m', 1254, 5000, 22, 125.4, 177, 351, 158, '', 'sheet'),
  ('sheet:2026-07-16:2,000m test:2000', '2026-07-16', '2,000m test', 454, 2000, 30, 113.6, 239, 159, 174, '7:34.4 — first test', 'sheet'),
  ('sheet:2026-07-18:60 min steady:13540', '2026-07-18', '60 min steady', 3602, 13540, 18, 133, 149, 896, 134, 'Recovery week start', 'sheet'),
  ('sheet:2026-07-21:Just Row:7200', '2026-07-21', 'Just Row', 1881, 7200, 20, 130.6, 157, 485, 142, '', 'sheet'),
  ('sheet:2026-07-23:8x500m/1:00r:4000', '2026-07-23', '8x500m/1:00r', 970, 4000, 26, 121.2, 197, 293, 164, 'Crisp', 'sheet'),
  ('sheet:2026-07-25:10,000m:10000', '2026-07-25', '10,000m', 2636, 10000, 20, 131.8, 153, 668, 141, 'Negative split last 2k', 'sheet'),
  ('sheet:2026-07-28:4x1,000m/2:00r:4000', '2026-07-28', '4x1,000m/2:00r', 979, 4000, 24, 122.4, 191, 289, 159, '', 'sheet'),
  ('sheet:2026-07-30:45 min steady:10380', '2026-07-30', '45 min steady', 2703, 10380, 18, 130.2, 159, 703, 136, 'Legs better', 'sheet'),
  ('sheet:2026-08-01:5,000m:5000', '2026-08-01', '5,000m', 1242, 5000, 23, 124.2, 183, 356, 157, '20:42', 'sheet'),
  ('sheet:2026-08-04:Pyramid 500-1k-1500-1k-500:4500', '2026-08-04', 'Pyramid 500-1k-1500-1k-500', 1098, 4500, 26, 122, 193, 327, 163, 'Fun one', 'sheet'),
  ('sheet:2026-08-06:30 min steady:6980', '2026-08-06', '30 min steady', 1801, 6980, 20, 129, 163, 476, 145, '', 'sheet'),
  ('sheet:2026-08-08:6x750m/1:30r:4500', '2026-08-08', '6x750m/1:30r', 1094, 4500, 26, 121.6, 195, 328, 165, '', 'sheet'),
  ('sheet:2026-08-11:10,000m:10000', '2026-08-11', '10,000m', 2608, 10000, 20, 130.4, 158, 675, 140, 'Comfortable', 'sheet'),
  ('sheet:2026-08-13:2,000m test:2000', '2026-08-13', '2,000m test', 448, 2000, 31, 112.1, 248, 161, 176, '7:28.4 PB', 'sheet'),
  ('sheet:2026-08-15:40 min easy:8680', '2026-08-15', '40 min easy', 2399, 8680, 18, 138.2, 133, 554, 128, 'Flush after 2k', 'sheet'),
  ('sheet:2026-08-18:5,000m:5000', '2026-08-18', '5,000m', 1230, 5000, 23, 123, 188, 359, 156, '20:30', 'sheet'),
  ('sheet:2026-08-20:8x500m/1:00r:4000', '2026-08-20', '8x500m/1:00r', 958, 4000, 28, 119.8, 204, 297, 168, 'Best interval set', 'sheet'),
  ('sheet:2026-08-23:5,000m:5000', '2026-08-23', '5,000m', 1228, 5000, 23, 122.8, 189, 360, 155, '20:28 — 5k PB', 'sheet')
on conflict (source_key) do nothing;
