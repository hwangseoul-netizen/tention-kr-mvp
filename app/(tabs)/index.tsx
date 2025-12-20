// app/(tabs)/index.tsx — TENtion KR v1.5.3 (Web/Mobile MVP 안정판)
// ✅ duration 필터: slot.totalMins <= selectedDuration (이하만 노출)
// ✅ 지역 선택: 체크=포함, 0개 선택 방지(최소 1개 강제)
// ✅ 체크인 UX: 웹에서도 100% 동작하는 Confirm Sheet(오버레이) + 완료 알림
// ✅ 자동 슬롯: "카페 30~100분 다양 주제" + "한강/강남 산책/조깅" 중심
// ✅ 슬롯 많이 보이게: distKm 1~10 집중 + 기본 radius 상향 + CAP 확장
// ✅ 만들기: 시작시간 입력 + 10~100분 탭하면 종료시간 자동완성(직접 수정 가능)

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";

/* ---- default export ---- */
export default function Screen() {
  return <Root />;
}

/* =========================
   i18n (KO만 사용)
========================= */
const T = {
  app: "TENtion KR",
  my: "내 모임",
  create: "+ 만들기",
  searchPH: "제목/도시/주제/키워드 검색…",
  sort: "정렬 기준",
  sortOpt: ["마감 임박", "최신순", "가까운순", "평점순"],
  time: "시간대",
  timeBands: ["이른 아침", "오전", "점심", "오후", "저녁"],
  distance: "km",
  duration: "최대(분)",
  noSlotsT: "표시할 슬롯이 없어요",
  noSlotsS: "지역/거리/시간 필터를 조정해봐.",
  details: "자세히",
  checkin: "체크인",
  leave: "취소",
  share: "공유",
  back: "← 뒤로",
  safetyNote: "밝은 공공장소에서 만나고, DM 금지. 싫으면 언제든 나가기.",
  cat: { Dating: "Vibe", Friends: "Friends", Workout: "Workout", Talk: "Cafe Talk" },
  host: { me: "내가 주최", plat: "TENtion 주최" },
  createTitle: "슬롯 만들기",
  category: "카테고리",
  hostLabel: "주최",
  pickCityTime: "도시",
  startEnd: "시작/종료 (24H)",
  title: "제목",
  titlePH: "슬롯 제목",
  desc: "설명",
  descPH: "짧은 설명",
  safetyTips: "안전수칙",
  createCTA: "만들기",
  selectCity: "도시 선택",
  done: "완료",
  live: "진행중",
  ended: "종료",
  multiCity: "지역(복수선택)",
  apply: "적용",
  reset: "초기화",
  regionMore: "지역선택 ▾",
  ok: "OK",
  confirm: "확인",
  cancel: "취소",
};

/* =========================
   Constants
========================= */
const KM_STEP = 1;

// ✅ 10~100 (2줄, 5개씩)
const DUR_OPTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const CATS = [
  { key: "Dating", label: "Vibe", icon: "💞", color: "#FF5CAB" },
  { key: "Friends", label: "Friends", icon: "🤝", color: "#2EE778" },
  { key: "Workout", label: "Workout", icon: "💪", color: "#FFA23B" },
  { key: "Talk", label: "Cafe Talk", icon: "☕", color: "#6AAEFF" },
];

// 대표/전국
const CITY_LIST = [
  { code: "GN", name: "강남/역삼", region: "서울" },
  { code: "HD", name: "홍대/합정", region: "서울" },
  { code: "JS", name: "잠실/석촌", region: "서울" },
  { code: "GS", name: "성수/건대", region: "서울" },
  { code: "YD", name: "여의도", region: "서울" },
  { code: "SEO", name: "서울(기타)", region: "서울" },
  { code: "SUW", name: "수원", region: "경기" },
  { code: "GGN", name: "경기 북부", region: "경기" },
  { code: "GGS", name: "경기 남부", region: "경기" },
  { code: "ICN", name: "인천/송도", region: "수도권" },
  { code: "BUS", name: "부산", region: "영남" },
  { code: "DG", name: "대구", region: "영남" },
  { code: "DJ", name: "대전", region: "충청" },
  { code: "GJ", name: "광주", region: "호남" },
  { code: "USN", name: "울산", region: "영남" },
];

const CITY: Record<string, { code: string; name: string; region: string }> = CITY_LIST.reduce(
  (m: any, c) => {
    m[c.code] = c;
    return m;
  },
  {}
);
const cityName = (code: string) => CITY[code]?.name || code;
const HOT5 = ["GN", "YD", "JS", "GS", "HD"]; // ✅ 강남+한강권 우선

/* =========================
   Helpers
========================= */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const uniq = (arr: string[]) => Array.from(new Set(arr));
const includes = (arr: string[] | undefined, v: string) => (arr || []).includes(v);

function notify(title: string, msg: string) {
  // ✅ 웹에서도 확실하게 뜨게
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    (globalThis as any).alert?.(`${title}\n\n${msg}`) ?? console.log(title, msg);
    return;
  }
  Alert.alert(title, msg);
}

function parseHM(str: string) {
  if (!str || !/^\d{2}:\d{2}$/.test(str)) return null;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}
const fmt24 = (str?: string) => str || "—";
const pad2 = (n: number) => String(n).padStart(2, "0");
const toTimeString = (m: number) => `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;

function computeEndHM(startHM: string, mins: number) {
  const st = parseHM(startHM);
  const base = st == null ? 18 * 60 : st;
  const en = (base + mins) % 1440;
  return `${pad2(Math.floor(en / 60))}:${pad2(en % 60)}`;
}

function spanMins(start: string, end: string) {
  const s = parseHM(start),
    e = parseHM(end);
  if (s == null || e == null) return 30;
  let d = e - s;
  if (d <= 0) d += 1440;
  return d;
}

const tintByMins = (mins: number) =>
  mins <= 0
    ? { color: "#666" }
    : mins <= 10
    ? { color: "#FF5A5A", fontWeight: "800" as const }
    : mins <= 30
    ? { color: "#FF9F1A", fontWeight: "800" as const }
    : { color: "#6AAEFF" };

const stars = (n?: number) => (!n ? "⭐ —" : "⭐".repeat(Math.max(1, Math.min(5, Math.round(n)))));

const colorFor = (type: string) =>
  type === "Dating" ? "#FF5CAB" : type === "Friends" ? "#2EE778" : type === "Workout" ? "#FFA23B" : "#6AAEFF";

const iconFor = (type: string) => (type === "Dating" ? "💞" : type === "Friends" ? "🤝" : type === "Workout" ? "💪" : "☕");

/* ===== Details helpers ===== */
const WEEK_KR = ["일", "월", "화", "수", "목", "금", "토"];
function formatKRDate(d = new Date()) {
  const y = d.getFullYear(),
    m = d.getMonth() + 1,
    day = d.getDate(),
    w = WEEK_KR[d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${w})`;
}
function toAmPm(hm: string) {
  const [hh, mm] = hm.split(":").map(Number);
  const h = ((hh + 11) % 12) + 1;
  const ampm = hh < 12 ? "AM" : "PM";
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${ampm}`;
}
function bandEmoji(band: string) {
  if (band === "이른 아침") return "🌅";
  if (band === "오전") return "☕";
  if (band === "점심") return "🍽️";
  if (band === "오후") return "🌤️";
  return "🌇";
}
const DEFAULT_VIBES = ["가볍고 친절", "차분하게 진지", "에너지+집중", "담백하고 솔직"];
function tasksFor(slot: Slot) {
  if (slot.type === "Workout") return ["가볍게 워밍업 🧘‍♂️", "한강 코스 공유 🏃", "끝나고 5분 정리 🔄"];
  if (slot.type === "Dating") return ["서로 한 줄 소개 ✨", "요즘 꽂힌 것 1개 💬", "10분 리캡 🔄"];
  if (slot.type === "Friends") return ["가벼운 근황 😊", "요즘 재밌는 것 ☀️", "추천 하나 공유 💡"];
  return ["주제 1개 정하고 토크 ☕", "각자 인사이트 1개 💡", "끝나고 한 줄 정리 ✨"];
}

/* ---- countdown helpers ---- */
function buildTodayTs(hm: string) {
  const now = new Date();
  const [h, m] = hm.split(":").map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0).getTime();
}
function getState(nowMs: number, startHM: string, durMin: number) {
  const start = buildTodayTs(startHM);
  const end = start + durMin * 60 * 1000;
  if (nowMs < start) return { state: "upcoming" as const, start, end, secsToStart: Math.floor((start - nowMs) / 1000) };
  if (nowMs <= end) return { state: "live" as const, start, end, secsToStart: 0 };
  return { state: "ended" as const, start, end, secsToStart: 0 };
}
function fmtHMS(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/* =========================
   Types
========================= */
type Slot = {
  id: number;
  type: "Dating" | "Friends" | "Workout" | "Talk";
  city: string;
  band: string;
  title: string;
  start: string;
  end: string;
  totalMins: number;
  desc: string;
  proofScore: number;
  hostType: "platform" | "me";
  ageRange?: [number, number];
  vibe?: string;
  attendees: string[];
  distKm: number;
  origin?: "gen" | "user";
};

/* =========================
   Auto Slot Generator (KR)
========================= */
const BAND_ANCHOR: Record<string, string> = { "이른 아침": "07:00", "오전": "10:30", "점심": "13:00", "오후": "16:30", "저녁": "19:30" };

function guessBandFromStart(hm: string) {
  const m = parseHM(hm) || 0,
    h = Math.floor(m / 60);
  if (h < 9) return "이른 아침";
  if (h < 12) return "오전";
  if (h < 15) return "점심";
  if (h < 19) return "오후";
  return "저녁";
}
function weightedPick<T>(list: T[], wts: number[]) {
  if (!wts || wts.length !== list.length) return list[Math.floor(Math.random() * list.length)];
  const sum = wts.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < list.length; i++) {
    if ((r -= wts[i]) <= 0) return list[i];
  }
  return list[list.length - 1];
}
function addMin(startHM: string, delta: number) {
  const m = (parseHM(startHM) || 0) + delta;
  const mm = ((m % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(mm / 60))}:${pad2(mm % 60)}`;
}

// ✅ “카페 토크” 중심 + 한강/강남 산책/조깅
const CAFE_TOPICS = [
  "창업/비즈 아이디어",
  "AI/툴 공유",
  "마케팅/광고",
  "커리어/이직",
  "영어 스몰톡",
  "독서/요약",
  "연애/관계",
  "습관/루틴",
  "투자/경제(가볍게)",
  "콘텐츠/유튜브",
  "디자인/브랜딩",
  "자기계발/멘탈",
];

const CAFE_PLACES: Record<string, string[]> = {
  GN: ["강남역 카페", "역삼 카페", "선릉 카페", "삼성 카페", "코엑스 카페"],
  YD: ["여의도 카페", "IFC 카페", "한강공원 앞 카페"],
  GS: ["성수 카페거리", "서울숲 카페", "성수 로스터리"],
  JS: ["석촌호수 카페", "잠실 카페", "롯데월드몰 카페"],
  HD: ["합정 카페", "홍대 카페", "망원 카페"],
  SEO: ["서울 카페"],
};

const RIVER_RUN_PLACES: Record<string, string[]> = {
  GN: ["한강 잠원지구", "반포한강공원", "청담 한강 산책로"],
  YD: ["여의도한강공원", "샛강생태공원"],
  JS: ["잠실한강공원", "석촌호수 산책로"],
  GS: ["뚝섬한강공원", "서울숲 산책로"],
  HD: ["망원한강공원", "홍대-망원 산책로"],
  SEO: ["한강 산책로"],
};

function pickDistKm() {
  // ✅ 1~10에 집중(기본 radius에서도 많이 보이게)
  const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const wts = [10, 10, 9, 8, 8, 6, 5, 4, 2, 1];
  return weightedPick(opts, wts);
}

function generateKRSlots({ cityCode = "GN", band = "저녁", count = 30 }: { cityCode: string; band: string; count: number }): Slot[] {
  const list: Slot[] = [];
  const anchor = BAND_ANCHOR[band] || "19:30";

  // ✅ 카페가 메인, 산책/조깅은 일부 섞기(요청대로 한강/강남 위주)
  const cats: Slot["type"][] = ["Talk", "Talk", "Friends", "Dating", "Workout"];
  const catWts = [8, 8, 5, 3, 4];

  for (let i = 0; i < count; i++) {
    const type = weightedPick(cats, catWts);

    const isWorkout = type === "Workout";
    const place = isWorkout
      ? (RIVER_RUN_PLACES[cityCode] || RIVER_RUN_PLACES["SEO"])[Math.floor(Math.random() * (RIVER_RUN_PLACES[cityCode] || RIVER_RUN_PLACES["SEO"]).length)]
      : (CAFE_PLACES[cityCode] || CAFE_PLACES["SEO"])[Math.floor(Math.random() * (CAFE_PLACES[cityCode] || CAFE_PLACES["SEO"]).length)];

    // ✅ 30~100 위주로 다양하게
    const durChoices = [30, 40, 50, 60, 70, 80, 90, 100];
    const durWts = [8, 8, 7, 7, 5, 4, 3, 3];
    const d = weightedPick(durChoices, durWts);

    const start = addMin(anchor, 10 * Math.floor(Math.random() * 18));
    const end = addMin(start, d);
    const tb = guessBandFromStart(start);

    const topic = isWorkout
      ? weightedPick(["한강 산책", "가벼운 조깅", "러닝 루틴", "걷기+대화"], [6, 6, 3, 4])
      : CAFE_TOPICS[Math.floor(Math.random() * CAFE_TOPICS.length)];

    const vibe = DEFAULT_VIBES[Math.floor(Math.random() * DEFAULT_VIBES.length)];
    const distKm = pickDistKm();

    const title =
      isWorkout
        ? `${place} • ${topic}`
        : `${place} • ${topic}`;

    const desc =
      isWorkout
        ? "한강/도심 산책·조깅. 무리하지 말고 페이스 맞추기."
        : "카페에서 30~100분. 가볍게 이야기하고 끝나면 깔끔하게 헤어지기.";

    list.push({
      origin: "gen",
      id: Date.now() + Math.floor(Math.random() * 1e6),
      type,
      city: cityCode,
      band: tb,
      title,
      start,
      end,
      totalMins: d,
      desc,
      proofScore: Math.round(3 + Math.random() * 2),
      hostType: "platform",
      vibe,
      attendees: [],
      distKm,
    });
  }
  return list.sort((a, b) => b.id - a.id);
}

/* =========================
   Root
========================= */
const ME = "You";

function Root() {
  const t = T;
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // filters
  const [activeCat, setActiveCat] = useState<Slot["type"] | "">("");
  const [radius, setRadius] = useState(10); // ✅ 기본 10km로 (슬롯이 너무 적게 보이던 문제 방지)
  const [dur, setDur] = useState(100);
  const [sortBy, setSortBy] = useState(t.sortOpt[0]);

  // ✅ 지역 선택: Array
  const [selectedCities, setSelectedCities] = useState<string[]>(HOT5);

  const toggleCity = (code: string) => {
    setSelectedCities((prev) => {
      const has = prev.includes(code);
      if (has && prev.length === 1) {
        notify("지역 선택", "최소 1개 지역 이상 선택해줘.");
        return prev;
      }
      return has ? prev.filter((x) => x !== code) : [...prev, code];
    });
  };

  const [showCitySheet, setShowCitySheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [myOnly, setMyOnly] = useState(false);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  // slots
  const [slots, setSlots] = useState<Slot[]>([]);

  // ✅ 체크인 Confirm Sheet
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinTargetId, setCheckinTargetId] = useState<number | null>(null);
  const [checkinMode, setCheckinMode] = useState<"join" | "leave">("join");

  const openCheckin = (slot: Slot, mode: "join" | "leave") => {
    setCheckinTargetId(slot.id);
    setCheckinMode(mode);
    setCheckinOpen(true);
  };

  const checkinTarget = useMemo(() => {
    if (!checkinTargetId) return undefined;
    return slots.find((s) => s.id === checkinTargetId);
  }, [checkinTargetId, slots]);

  // ✅ 자동 슬롯: 시간대 제한 없이(모든 timeBands 섞어 생성)
  // ✅ user 슬롯 유지
  useEffect(() => {
    const base = selectedCities.length ? selectedCities : HOT5;

    const CAP = 120; // ✅ 50개 이상 보이게 넉넉히
    const perCity = Math.max(18, Math.floor(90 / base.length));
    const perBand = Math.max(3, Math.floor(perCity / T.timeBands.length));

    const packs = base.flatMap((code) =>
      T.timeBands.flatMap((b) => generateKRSlots({ cityCode: code, band: b, count: perBand }))
    );

    setSlots((prev) => {
      const user = prev.filter((s) => s.origin === "user");
      const remain = Math.max(0, CAP - user.length);
      return [...user, ...packs.slice(0, remain)];
    });
  }, [selectedCities]);

  const resetHome = () => {
    setActiveCat("");
    setRadius(10);
    setDur(100);
    setSortBy(t.sortOpt[0]);
    setSearch("");
    setMyOnly(false);
    setSelectedCities(HOT5);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const list = useMemo(() => {
    if (selectedCities.length === 0) return [];

    let arr = slots.slice();

    if (activeCat) arr = arr.filter((s) => s.type === activeCat);

    // ✅ 지역 포함
    arr = arr.filter((s) => selectedCities.includes(s.city));

    // ✅ 진행시간 필터(이하)
    arr = arr.filter((s) => (s.totalMins || 30) <= dur);

    // ✅ 거리 필터
    arr = arr.filter((s) => (s.distKm || 999) <= radius);

    // ✅ 내 모임: 내가 체크인했거나, 내가 만든 모임(hostType === "me")
    if (myOnly) arr = arr.filter((s) => includes(s.attendees, ME) || s.hostType === "me");

    // ✅ 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((s) => {
        const txt = `${s.title} ${s.type} ${cityName(s.city)} ${s.band}`.toLowerCase();
        return txt.includes(q);
      });
    }

    // ✅ 정렬
    if (sortBy === t.sortOpt[0]) {
      arr.sort((a, b) => getUrgencyMins(nowMs, a) - getUrgencyMins(nowMs, b));
    }
    if (sortBy === t.sortOpt[1]) arr.sort((a, b) => b.id - a.id);
    if (sortBy === t.sortOpt[2]) arr.sort((a, b) => (a.distKm || 999) - (b.distKm || 999));
    if (sortBy === t.sortOpt[3]) arr.sort((a, b) => (b.proofScore || 0) - (a.proofScore || 0));

    return arr;
  }, [slots, activeCat, dur, radius, sortBy, selectedCities, search, myOnly, nowMs]);

  const [screen, setScreen] = useState<"home" | "detail">("home");
  const [selId, setSelId] = useState<number | null>(null);

  // ✅ 실제 체크인 처리(확실히 반영)
  const applyJoin = (slot?: Slot) => {
    if (!slot) return;

    const gs = getState(nowMs, slot.start, slot.totalMins || 30);
    if (gs.state === "ended") {
      notify("종료됨", "이미 종료된 모임이야.");
      return;
    }

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slot.id) return s;
        const already = includes(s.attendees, ME);
        const nextAtt = already ? s.attendees : [...(s.attendees || []), ME];
        return { ...s, attendees: nextAtt };
      })
    );

    notify("체크인 완료", "모임에 포함됐어 ✅");
  };

  const applyLeave = (slot?: Slot) => {
    if (!slot) return;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== slot.id) return s;
        return { ...s, attendees: (s.attendees || []).filter((x) => x !== ME) };
      })
    );
    notify("취소 완료", "모임에서 나갔어.");
  };

  const shareSlot = async (slot?: Slot) => {
    if (!slot) return;
    try {
      await Share.share({ message: `TENtion • ${slot.title}\n${T.cat[slot.type] || slot.type} @ ${cityName(slot.city)} • ${slot.band}` });
    } catch (e) {}
  };

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [showCitySingle, setShowCitySingle] = useState(false);

  const [form, setForm] = useState({
    cat: "" as Slot["type"] | "",
    host: T.host.me,
    city: "GN",
    start: "18:00",
    end: "19:00",
    dur: 60,
    autoEnd: true,
    title: "",
    desc: "",
  });

  const openCreate = () => {
    Keyboard.dismiss();
    const firstSel = selectedCities[0] || "GN";
    setForm((f) => ({
      ...f,
      cat: activeCat || "Talk",
      city: firstSel,
      dur: 60,
      autoEnd: true,
      start: "18:00",
      end: computeEndHM("18:00", 60),
      title: "",
      desc: "",
    }));
    setCreateOpen(true);
  };

  const createSlot = () => {
    Keyboard.dismiss();

    const mins = clamp(form.dur, 10, 100);
    const end = computeEndHM(form.start, mins);
    const mappedHost = form.host === T.host.plat ? "platform" : "me";

    const cat = (form.cat || "Talk") as Slot["type"];
    const city = form.city || "GN";

    const s: Slot = {
      origin: "user",
      id: Date.now() + Math.floor(Math.random() * 1e6),
      type: cat,
      hostType: mappedHost,
      city,
      band: guessBandFromStart(form.start),
      title: (form.title || defaultTitle(cat)).trim(),
      start: form.start,
      end,
      totalMins: mins,
      desc: (form.desc || defaultDesc(cat)).trim(),
      proofScore: 0,
      vibe: DEFAULT_VIBES[Math.floor(Math.random() * DEFAULT_VIBES.length)],
      attendees: [],
      distKm: pickDistKm(),
    };

    setSlots((prev) => [s, ...prev]);
    setCreateOpen(false);

    // ✅ 생성 즉시 보이게: 카테고리/지역/필터 조정
    setActiveCat(cat);
    setSelectedCities((prev) => uniq(prev.includes(city) ? prev : [...prev, city]));
    setDur(100);
    setRadius((r) => Math.max(r, 10));

    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
    notify("생성 완료", "피드 최상단에 업로드됐어 ✅");
  };

  const selectedSlot = selId ? slots.find((s) => s.id === selId) : undefined;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={resetHome} style={{ flexDirection: "row", alignItems: "flex-end" }} hitSlop={10}>
          <Text style={styles.logo}>{t.app}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TouchableOpacity style={[styles.secondarySm, myOnly && styles.secondarySmOn]} onPress={() => setMyOnly((v) => !v)}>
            <Text style={[styles.secondarySmT, myOnly && styles.secondarySmTOn]}>{t.my}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primarySm} onPress={openCreate}>
            <Text style={styles.primarySmT}>{t.create}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={(r) => (scrollRef.current = r)}
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* CATEGORIES — 1줄 고정 그리드 */}
        <View style={styles.catRow}>
          {CATS.map((c) => {
            const on = activeCat === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setActiveCat((p) => (p === c.key ? "" : (c.key as any)))}
                style={[styles.catChip, { borderColor: c.color }, on && { backgroundColor: c.color + "22" }]}
              >
                <Text style={[styles.catText, { color: c.color }]} numberOfLines={1} ellipsizeMode="tail">
                  {c.icon} {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Row: distance • duration • sort */}
        <View style={styles.row3}>
          <Stepper label={t.distance} value={radius} onMinus={() => setRadius(clamp(radius - KM_STEP, 1, 50))} onPlus={() => setRadius(clamp(radius + KM_STEP, 1, 50))} />
          <Stepper label={t.duration} value={dur} step={10} onMinus={() => setDur(clamp(dur - 10, 10, 100))} onPlus={() => setDur(clamp(dur + 10, 10, 100))} />
          <TouchableOpacity style={styles.sortBtn} onPress={() => { Keyboard.dismiss(); setShowSortSheet(true); }}>
            <Text style={styles.sortBtnT} numberOfLines={1}>
              {t.sort}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 핫 지역 5 + 지역선택 */}
        <View style={styles.hotRow}>
          {HOT5.map((code) => {
            const on = selectedCities.includes(code);
            return (
              <TouchableOpacity key={code} onPress={() => toggleCity(code)} style={[styles.cityChip, on && styles.cityChipActive]}>
                <Text style={[styles.cityChipT, on && styles.cityChipTActive]} numberOfLines={1}>
                  {cityName(code)}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.moreChip} onPress={() => { Keyboard.dismiss(); setShowCitySheet(true); }}>
            <Text style={styles.moreChipT} numberOfLines={1}>
              {T.regionMore}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH */}
        <TextInput value={search} onChangeText={setSearch} placeholder={t.searchPH} placeholderTextColor="#7a8596" style={styles.search} />

        {/* FEED */}
        {list.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyT}>{t.noSlotsT}</Text>
            <Text style={styles.emptyS}>{t.noSlotsS}</Text>
          </View>
        )}

        {list.map((s) => {
          const joined = includes(s.attendees, ME);
          return (
            <Card
              key={s.id}
              slot={s}
              joined={joined}
              nowMs={nowMs}
              onDetails={() => { setSelId(s.id); setScreen("detail"); }}
              onPrimary={() => openCheckin(s, joined ? "leave" : "join")}
            />
          );
        })}

        <View style={styles.noteBox}>
          <Text style={styles.note}>{t.safetyNote}</Text>
        </View>
      </ScrollView>

      {/* SORT SHEET */}
      {showSortSheet && (
        <ActionSheet
          title={t.sort}
          value={sortBy}
          options={t.sortOpt}
          onPick={(v) => {
            setSortBy(v);
            setShowSortSheet(false);
          }}
          onCancel={() => setShowSortSheet(false)}
        />
      )}

      {/* MULTI CITY SHEET */}
      {showCitySheet && (
        <MultiCitySheet
          currentList={selectedCities}
          onApply={(codes) => {
            if (!codes.length) {
              notify("지역 선택", "최소 1개 지역 이상 선택해줘.");
              return;
            }
            setSelectedCities(codes);
            setShowCitySheet(false);
          }}
          onClose={() => setShowCitySheet(false)}
        />
      )}

      {/* CHECKIN SHEET */}
      {checkinOpen && (
        <CheckinSheet
          slot={checkinTarget}
          mode={checkinMode}
          onClose={() => setCheckinOpen(false)}
          onConfirm={() => {
            const slot = checkinTarget;
            setCheckinOpen(false);
            if (!slot) return;
            if (checkinMode === "join") applyJoin(slot);
            else applyLeave(slot);
          }}
        />
      )}

      {/* CREATE MODAL */}
      {createOpen && (
        <CreateModal
          form={form}
          setForm={setForm}
          onClose={() => setCreateOpen(false)}
          onCreate={createSlot}
          onOpenCity={() => { Keyboard.dismiss(); setShowCitySingle(true); }}
        />
      )}

      {/* CREATE CITY SINGLE SHEET */}
      {showCitySingle && (
        <CitySheetSingle
          current={form.city}
          onPick={(v) => {
            setForm((f: any) => ({ ...f, city: v }));
            setShowCitySingle(false);
          }}
          onClose={() => setShowCitySingle(false)}
        />
      )}

      {/* DETAILS */}
      {screen === "detail" && selId && (
        <Details
          slot={selectedSlot}
          nowMs={nowMs}
          onBack={() => setScreen("home")}
          onShare={() => shareSlot(selectedSlot)}
          onJoin={() => {
            if (!selectedSlot) return;
            openCheckin(selectedSlot, includes(selectedSlot.attendees, ME) ? "leave" : "join");
          }}
          onLeave={() => {
            if (!selectedSlot) return;
            openCheckin(selectedSlot, "leave");
          }}
        />
      )}
    </SafeAreaView>
  );
}

/* =========================
   UI Components
========================= */

function Stepper({ label, value, step = 1, onMinus, onPlus }: { label: string; value: number; step?: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={onMinus} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.stepBtnT}>−</Text>
      </TouchableOpacity>
      <View style={styles.stepMid}>
        <Text style={styles.stepVal} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.stepLbl} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <TouchableOpacity style={styles.stepBtn} onPress={onPlus} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.stepBtnT}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

function getUrgencyMins(nowMs: number, slot: Slot) {
  const gs = getState(nowMs, slot.start, slot.totalMins || 30);
  if (gs.state === "upcoming") return Math.max(0, Math.ceil(gs.secsToStart / 60));
  if (gs.state === "live") return Math.max(0, Math.ceil((gs.end - nowMs) / 60000));
  return 999999;
}

function Card({
  slot,
  onDetails,
  onPrimary,
  nowMs,
  joined,
}: {
  slot: Slot;
  onDetails: () => void;
  onPrimary: () => void;
  nowMs: number;
  joined: boolean;
}) {
  const gs = getState(nowMs, slot.start, slot.totalMins || 30);
  const urgencyMins = getUrgencyMins(nowMs, slot);
  const tint = tintByMins(urgencyMins);
  const ratio =
    gs.state === "live" && slot.totalMins
      ? clamp((gs.end - nowMs) / (slot.totalMins * 60 * 1000), 0, 1)
      : gs.state === "upcoming"
      ? clamp(1 - urgencyMins / Math.max(1, slot.totalMins), 0, 1)
      : 0;

  const rightBadge =
    gs.state === "upcoming"
      ? <MiniBadge text={`⏳ ${fmtHMS(gs.secsToStart)}`} tone="#3EC6FF" />
      : gs.state === "live"
      ? <MiniBadge text={T.live} tone="#2EE778" />
      : <MiniBadge text={T.ended} tone="#666" />;

  return (
    <View style={[styles.card, { borderColor: colorFor(slot.type) }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardType, { color: colorFor(slot.type) }]} numberOfLines={1}>
          {iconFor(slot.type)} {T.cat[slot.type] || slot.type} • {cityName(slot.city)} • {slot.band}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>{rightBadge}</View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {slot.title}
      </Text>

      <Text style={styles.cardLine}>
        🕒 {fmt24(slot.start)} ~ {fmt24(slot.end)} • {Math.max(10, slot.totalMins || 30)}분 • <Text style={tint as any}>{toTimeString(urgencyMins)}</Text>
      </Text>

      <Text style={styles.cardLine}>
        📍 {slot.distKm}km • 👥 {slot.attendees?.length || 0}명 • {stars(slot.proofScore)}
      </Text>

      <View style={styles.progOuter}>
        <View style={[styles.progInner, { width: `${Math.max(4, ratio * 100)}%`, backgroundColor: (tint as any).color || "#6AAEFF" }]} />
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>
        {slot.desc}
      </Text>

      <View style={styles.cardFoot}>
        <TouchableOpacity style={styles.outBtn} onPress={onDetails}>
          <Text style={styles.outBtnT}>{T.details}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.inBtn, joined && { backgroundColor: "#3A3F4A" }]} onPress={onPrimary}>
          <Text style={[styles.inBtnT, joined && { color: "#fff" }]}>{joined ? T.leave : T.checkin}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Details({
  slot,
  onBack,
  onShare,
  onJoin,
  onLeave,
  nowMs,
}: {
  slot?: Slot;
  onBack: () => void;
  onShare: () => void;
  onJoin: () => void;
  onLeave: () => void;
  nowMs: number;
}) {
  if (!slot) return null;

  const joined = (slot.attendees || []).includes(ME);
  const gs = getState(nowMs, slot.start, slot.totalMins || 30);
  const labelTone = gs.state === "live" ? "#2EE778" : gs.state === "upcoming" ? "#3EC6FF" : "#666";
  const labelText = gs.state === "upcoming" ? `⏳ ${fmtHMS(gs.secsToStart)}` : gs.state === "live" ? T.live : T.ended;

  const urgencyMins = getUrgencyMins(nowMs, slot);
  const tint = tintByMins(urgencyMins);
  const ratio = gs.state === "live" ? clamp((gs.end - nowMs) / ((slot.totalMins || 30) * 60 * 1000), 0, 1) : 0;

  const vibe = slot.vibe || DEFAULT_VIBES[Math.floor(Math.random() * DEFAULT_VIBES.length)];
  const hostLabel = slot.hostType === "platform" ? "TENtion Korea" : "User Host";
  const cityLabel = cityName(slot.city);
  const dateStr = formatKRDate(new Date());
  const startAmPm = toAmPm(slot.start);
  const minText = `${slot.totalMins || 30}분`;
  const placeTitle = (slot.title || "").split(" • ")[0] || cityLabel;

  return (
    <View style={styles.detailWrap}>
      <SafeAreaView />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{T.back}</Text>
        </TouchableOpacity>

        <View style={[styles.detailsBox, { borderColor: colorFor(slot.type) }]}>
          <View style={styles.badgeRow}>
            <MiniBadge text={`${iconFor(slot.type)} ${T.cat[slot.type] || slot.type}`} tone={colorFor(slot.type)} />
            <MiniBadge text={labelText} tone={labelTone} />
          </View>

          <Text style={[styles.detailsTitle, { color: colorFor(slot.type) }]} numberOfLines={3}>
            {slot.title}
          </Text>

          <Text style={[styles.subBy]} numberOfLines={1}>
            💎 Hosted by <Text style={{ fontWeight: "900" }}>{hostLabel}</Text>
          </Text>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              {bandEmoji(slot.band)} {slot.band} — <Text style={{ fontWeight: "900" }}>Start {startAmPm}</Text> • Duration{" "}
              <Text style={{ fontWeight: "900" }}>{minText}</Text>
            </Text>
            <Text style={styles.infoLine}>
              📅 날짜: {dateStr} — {cityLabel}
            </Text>
            <Text style={styles.infoLine}>
              📍 거리 {slot.distKm}km • 👥 참여자 {slot.attendees?.length || 0}명 • 🎯 분위기 {vibe}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>📝 우리가 할 일</Text>
            {tasksFor(slot).map((tx, i) => (
              <Text key={i} style={styles.taskLine}>
                {["1️⃣", "2️⃣", "3️⃣"][i] || "•"} {tx}
              </Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>📍 장소</Text>
            <Text style={styles.placeLine}>
              {placeTitle} • {cityLabel}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>⏱️ 진행상황</Text>
            <Text style={styles.cardLine}>
              🕒 {fmt24(slot.start)} ~ {fmt24(slot.end)} • <Text style={tint as any}>{toTimeString(urgencyMins)}</Text>
            </Text>
            <View style={styles.progOuter}>
              <View style={[styles.progInner, { width: `${Math.max(4, ratio * 100)}%`, backgroundColor: (tint as any).color || "#6AAEFF" }]} />
            </View>
          </View>

          <View style={styles.policyBox}>
            <Text style={styles.secTitle}>✅ TENtion 방침</Text>
            <Text style={styles.policyLine}>• 공공장소 only  • DM 금지  • 언제든 퇴장 가능  • 예의 필수  • 결제 없음</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onShare}>
              <Text style={styles.secondaryText}>{T.share}</Text>
            </TouchableOpacity>

            {!joined && (
              <TouchableOpacity style={styles.primaryBtn} onPress={onJoin}>
                <Text style={styles.primaryText}>{T.checkin}</Text>
              </TouchableOpacity>
            )}

            {joined && (
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: "#FF5A5A", backgroundColor: "#FF5A5A22" }]} onPress={onLeave}>
                <Text style={[styles.secondaryText, { color: "#FF5A5A" }]}>{T.leave}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function MiniBadge({ text, tone }: { text: string; tone: string }) {
  return (
    <View style={[styles.miniBadge, { backgroundColor: tone + "22", borderColor: tone }]}>
      <Text style={[styles.miniBadgeT, { color: tone }]}>{text}</Text>
    </View>
  );
}

function ActionSheet({ title, value, options, onPick, onCancel }: { title: string; value: string; options: string[]; onPick: (v: string) => void; onCancel: () => void }) {
  return (
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onCancel} />
      <View style={styles.sheetCard}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {options.map((opt) => (
          <TouchableOpacity key={opt} style={styles.sheetItem} onPress={() => onPick(opt)}>
            <Text style={[styles.sheetItemT, value === opt && { color: "#3EC6FF" }]}>
              {opt}
              {value === opt ? " •" : ""}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 6 }]} onPress={onCancel}>
          <Text style={styles.primaryText}>{T.ok}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ✅ 체크인/취소 Confirm Sheet */
function CheckinSheet({
  slot,
  mode,
  onClose,
  onConfirm,
}: {
  slot?: Slot;
  mode: "join" | "leave";
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = mode === "join" ? "체크인 확인" : "취소 확인";
  const cta = mode === "join" ? "체크인 하기" : "나가기";
  const ctaTone = mode === "join" ? "#3EC6FF" : "#FF5A5A";

  return (
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
      <View style={styles.sheetCard}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{title}</Text>

        <View style={styles.confirmBox}>
          <Text style={styles.confirmLine}>✅ 공공장소에서 만나기</Text>
          <Text style={styles.confirmLine}>✅ DM 금지 / 예의 필수</Text>
          <Text style={styles.confirmLine}>✅ 싫으면 언제든 나가기</Text>
          {slot ? (
            <Text style={[styles.confirmLine, { color: "#cfd6e4", marginTop: 8 }]}>
              {iconFor(slot.type)} {slot.title}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
            <Text style={styles.secondaryText}>{T.cancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: ctaTone }]} onPress={onConfirm}>
            <Text style={[styles.primaryText, { color: "#0D0F13" }]}>{cta}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ✅ Multi City Sheet (복수 선택) — Array 기반 */
function MultiCitySheet({ currentList, onApply, onClose }: { currentList: string[]; onApply: (codes: string[]) => void; onClose: () => void }) {
  const [local, setLocal] = useState<string[]>(uniq(currentList || []));
  const toggle = (code: string) =>
    setLocal((prev) => {
      const has = prev.includes(code);
      if (has && prev.length === 1) {
        notify("지역 선택", "최소 1개 지역 이상 선택해줘.");
        return prev;
      }
      return has ? prev.filter((x) => x !== code) : [...prev, code];
    });
  const apply = () => {
    const next = uniq(local);
    if (!next.length) {
      notify("지역 선택", "최소 1개 지역 이상 선택해줘.");
      return;
    }
    onApply(next);
  };
  const reset = () => setLocal(currentList?.length ? [currentList[0]] : ["GN"]);

  // 그룹
  const groups: Record<string, { code: string; name: string; region: string }[]> = {};
  CITY_LIST.forEach((c) => {
    const g = c.region || "기타";
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });

  return (
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
      <View style={styles.sheetCardTall}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{T.multiCity}</Text>

        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} overScrollMode="never">
          {Object.keys(groups).map((gr) => (
            <View key={gr} style={{ marginBottom: 8 }}>
              <Text style={{ color: "#9aa", marginBottom: 6, fontWeight: "800" }}>{gr}</Text>
              {groups[gr].map((c) => {
                const on = local.includes(c.code);
                return (
                  <TouchableOpacity key={c.code} style={styles.cityRow} onPress={() => toggle(c.code)}>
                    <View style={[styles.chk, on && styles.chkOn]}>
                      <Text style={[styles.chkT, on && styles.chkTOn]}>✓</Text>
                    </View>
                    <Text style={[styles.cityRowT, on && { color: "#3EC6FF" }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
            <Text style={styles.secondaryText}>{T.reset}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={apply}>
            <Text style={styles.primaryText}>{T.apply}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* Create Modal */
function CreateModal({
  form,
  setForm,
  onClose,
  onCreate,
  onOpenCity,
}: {
  form: any;
  setForm: (updater: any) => void;
  onClose: () => void;
  onCreate: () => void;
  onOpenCity: () => void;
}) {
  const setDur = (v: number) =>
    setForm((f: any) => {
      const mins = clamp(v, 10, 100);
      const nextEnd = computeEndHM(f.start, mins);
      return { ...f, dur: mins, autoEnd: true, end: nextEnd };
    });

  return (
    <View style={styles.modalWrap}>
      <SafeAreaView />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{T.createTitle}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Category */}
          <Text style={styles.formLabel}>{T.category}</Text>
          <View style={styles.dualWrap}>
            {CATS.map((c) => (
              <TouchableOpacity
                key={c.key}
                onPress={() => setForm((f: any) => ({ ...f, cat: f.cat === c.key ? "" : c.key }))}
                style={[styles.formChipHalf, { borderColor: c.color, justifyContent: "center" }, form.cat === c.key && { backgroundColor: c.color + "22" }]}
              >
                <Text style={[styles.formChipT, { color: c.color, textAlign: "center" }]} numberOfLines={1}>
                  {c.icon} {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Host */}
          <Text style={styles.formLabel}>{T.hostLabel}</Text>
          <View style={styles.dualRow}>
            {[T.host.me, T.host.plat].map((h) => (
              <TouchableOpacity key={h} onPress={() => setForm((f: any) => ({ ...f, host: h }))} style={[styles.toggle, form.host === h && styles.toggleOn]}>
                <Text style={[styles.toggleT, form.host === h && styles.toggleTOn]} numberOfLines={1}>
                  {h}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* City */}
          <Text style={styles.formLabel}>{T.pickCityTime}</Text>
          <View style={styles.dualRow}>
            <Picker button={"도시"} value={cityName(form.city)} onPress={onOpenCity} />
          </View>

          {/* Start/End */}
          <Text style={styles.formLabel}>{T.startEnd}</Text>
          <View style={styles.dualRow}>
            <TextInput
              style={[styles.input, styles.duo]}
              placeholder="HH:MM"
              placeholderTextColor="#738"
              value={form.start}
              onChangeText={(t) =>
                setForm((f: any) => {
                  const next: any = { ...f, start: t };
                  if (f.autoEnd) {
                    const mins = clamp(f.dur, 10, 100);
                    next.end = computeEndHM(t, mins);
                  }
                  return next;
                })
              }
            />
            <TextInput
              style={[styles.input, styles.duo]}
              placeholder="HH:MM"
              placeholderTextColor="#738"
              value={form.end}
              onChangeText={(t) => setForm((f: any) => ({ ...f, end: t, autoEnd: false }))}
            />
          </View>

          {/* Duration */}
          <Text style={styles.formLabel}>진행시간(탭하면 종료시간 자동완성)</Text>
          <View style={styles.durationGrid}>
            {DUR_OPTS.map((n) => (
              <TouchableOpacity key={n} style={[styles.timeChipGrid, form.dur === n && styles.timeChipGridOn]} onPress={() => setDur(n)}>
                <Text style={[styles.timeChipGridT, form.dur === n && styles.timeChipGridTOn]}>{n} 분</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.formLabel}>{T.title}</Text>
          <TextInput style={styles.input} placeholder={T.titlePH} placeholderTextColor="#738" value={form.title} onChangeText={(v) => setForm((f: any) => ({ ...f, title: v }))} />

          {/* Desc */}
          <Text style={styles.formLabel}>{T.desc}</Text>
          <TextInput style={[styles.input, { minHeight: 130 }]} multiline placeholder={T.descPH} placeholderTextColor="#738" value={form.desc} onChangeText={(v) => setForm((f: any) => ({ ...f, desc: v }))} />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                notify("안전", "밝은 공공장소에서 만나고, 지인에게 일정 공유해줘.");
              }}
            >
              <Text style={styles.secondaryText}>{T.safetyTips}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={onCreate}>
              <Text style={styles.primaryText}>{T.createCTA}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* 단일 선택용 시트 */
function CitySheetSingle({ current, onPick, onClose }: { current: string; onPick: (code: string) => void; onClose: () => void }) {
  return (
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
      <View style={styles.sheetCardTall}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>{T.selectCity}</Text>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} overScrollMode="never">
          {CITY_LIST.map((c) => (
            <TouchableOpacity key={c.code} style={styles.cityRow} onPress={() => onPick(c.code)}>
              <Text style={[styles.cityRowT, current === c.code && { color: "#3EC6FF" }]} numberOfLines={1}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 10 }]} onPress={onClose}>
          <Text style={styles.primaryText}>{T.done}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Picker({ button, value, onPress }: { button: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.picker, styles.duo]} onPress={onPress}>
      <Text style={styles.pickerT} numberOfLines={1}>
        {button}: <Text style={{ color: "#fff" }}>{value}</Text>
      </Text>
    </TouchableOpacity>
  );
}

function defaultTitle(cat: Slot["type"]) {
  if (cat === "Dating") return "강남 카페 • Vibe";
  if (cat === "Friends") return "카페 • Friends";
  if (cat === "Workout") return "한강 • 러닝/산책";
  return "카페 • 토크";
}
function defaultDesc(cat: Slot["type"]) {
  if (cat === "Dating") return "카페에서 30~100분. 가볍게 대화하고 깔끔하게 끝.";
  if (cat === "Friends") return "카페에서 부담 없이 대화. 예의/시간 준수.";
  if (cat === "Workout") return "한강 산책/조깅. 페이스 맞추기.";
  return "카페에서 주제 하나 잡고 토크. DM 금지.";
}

/* =========================
   Styles
========================= */
const CONTROL_H = 44;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F13" },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 6, marginBottom: 6 },
  logo: { color: "#fff", fontSize: 28, fontWeight: "900" },
  primarySm: { backgroundColor: "#3EC6FF", paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  primarySmT: { color: "#0D0F13", fontWeight: "900" },
  secondarySm: { backgroundColor: "#3EC6FF22", borderWidth: 1, borderColor: "#3EC6FF", paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  secondarySmOn: { backgroundColor: "#3EC6FF" },
  secondarySmT: { color: "#3EC6FF", fontWeight: "800" },
  secondarySmTOn: { color: "#0D0F13", fontWeight: "900" },

  // Category — 4칩 고정폭(한 줄)
  catRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, marginBottom: 8 },
  catChip: { width: "23.5%", paddingVertical: 10, paddingHorizontal: 8, borderWidth: 2, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  catText: { fontWeight: "900", fontSize: 13 },

  // Row3 compact
  row3: { flexDirection: "row", gap: 8, marginBottom: 8, paddingHorizontal: 12 },
  stepper: { flex: 1, height: CONTROL_H, borderRadius: 12, backgroundColor: "#161A22", borderWidth: 1, borderColor: "#2A2F38", flexDirection: "row", overflow: "hidden" },
  stepBtn: { width: 48, alignItems: "center", justifyContent: "center" },
  stepBtnT: { color: "#fff", fontSize: 18, fontWeight: "900" },
  stepMid: { flex: 1, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#2A2F38" },
  stepVal: { color: "#fff", fontWeight: "900", fontSize: 16, lineHeight: 18 },
  stepLbl: { color: "#9aa", fontWeight: "700", fontSize: 11, marginTop: 2 },

  sortBtn: { width: 110, height: CONTROL_H, borderRadius: 12, backgroundColor: "#161A22", borderWidth: 1, borderColor: "#2A2F38", alignItems: "center", justifyContent: "center" },
  sortBtnT: { color: "#fff", fontWeight: "900", fontSize: 13 },

  // 핫지역 5 + 지역선택
  hotRow: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginBottom: 8, paddingHorizontal: 12 },
  cityChip: { flexBasis: "16%", height: 36, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#151821", borderWidth: 1, borderColor: "#2A2F38", alignItems: "center", justifyContent: "center" },
  cityChipActive: { backgroundColor: "#3A3F4A" },
  cityChipT: { color: "#9aa", fontWeight: "800", fontSize: 12 },
  cityChipTActive: { color: "#fff" },
  moreChip: { flexBasis: "16%", height: 36, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#151821", borderWidth: 1, borderColor: "#2A2F38", alignItems: "center", justifyContent: "center" },
  moreChipT: { color: "#ddd", fontWeight: "800", fontSize: 12 },

  // Search
  search: { backgroundColor: "#141821", color: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#232833", marginBottom: 8, marginHorizontal: 12 },

  // Empty
  empty: { padding: 14, borderRadius: 12, backgroundColor: "#151821", borderWidth: 1, borderColor: "#2A2F38", marginTop: 4, marginHorizontal: 12 },
  emptyT: { color: "#fff", fontWeight: "900", marginBottom: 4 },
  emptyS: { color: "#9aa" },

  // Card
  card: { borderWidth: 2, borderRadius: 12, padding: 12, marginBottom: 10, marginHorizontal: 12 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardType: { fontWeight: "900", fontSize: 12, maxWidth: "70%" },
  cardTitle: { color: "#fff", fontSize: 17, fontWeight: "900", marginBottom: 4 },
  cardLine: { color: "#bbb", fontSize: 12, marginBottom: 4 },
  cardDesc: { color: "#cfe8cf", fontSize: 12, marginTop: 2 },
  progOuter: { height: 6, backgroundColor: "#1A1D23", borderRadius: 6, overflow: "hidden", marginBottom: 6, marginTop: 2 },
  progInner: { height: 6, borderRadius: 6 },
  cardFoot: { flexDirection: "row", gap: 10, marginTop: 8 },
  outBtn: { borderWidth: 1, borderColor: "#555", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  outBtnT: { color: "#ddd", fontWeight: "800", fontSize: 12 },
  inBtn: { backgroundColor: "#3EC6FF", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  inBtnT: { color: "#0D0F13", fontWeight: "900", fontSize: 12 },

  // Details
  detailWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#0D0F13" },
  back: { color: "#9aa", marginBottom: 12, fontSize: 14 },
  detailsBox: { borderWidth: 2, borderRadius: 14, padding: 16 },
  detailsTitle: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  subBy: { color: "#dfe7f3", marginTop: 2, marginBottom: 10 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  miniBadge: { borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  miniBadgeT: { fontSize: 11, fontWeight: "800" },

  infoBlock: { backgroundColor: "#11161d", borderWidth: 1, borderColor: "#253041", borderRadius: 12, padding: 12, marginTop: 4 },
  infoLine: { color: "#dfe7f3", marginBottom: 6, fontSize: 14 },
  section: { marginTop: 12 },
  secTitle: { color: "#fff", fontWeight: "900", marginBottom: 6, fontSize: 16 },
  taskLine: { color: "#e7f1ff", marginBottom: 4, fontSize: 14, lineHeight: 20 },
  placeLine: { color: "#dfe", marginBottom: 4, fontSize: 14 },
  policyBox: { backgroundColor: "#101820", borderWidth: 1, borderColor: "#2A3748", borderRadius: 12, padding: 12, marginTop: 10 },
  policyLine: { color: "#cbd3df", fontSize: 13 },

  // Sheets
  sheetWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#0009", justifyContent: "flex-end" },
  sheetCard: { backgroundColor: "#151821", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, borderWidth: 1, borderColor: "#2A2F38" },
  sheetCardTall: { backgroundColor: "#151821", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, borderWidth: 1, borderColor: "#2A2F38", maxHeight: 520 },
  sheetHandle: { width: 44, height: 4, backgroundColor: "#2A2F38", borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 8 },
  sheetItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#262B35" },
  sheetItemT: { color: "#cfd6e4", fontSize: 16, fontWeight: "800" },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#262B35" },
  cityRowT: { color: "#cfd6e4", fontSize: 16, fontWeight: "800" },
  chk: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: "#3EC6FF22", alignItems: "center", justifyContent: "center", backgroundColor: "#1A1D23" },
  chkOn: { borderColor: "#3EC6FF", backgroundColor: "#3EC6FF22" },
  chkT: { color: "#6A7A8E", fontSize: 12, fontWeight: "900" },
  chkTOn: { color: "#3EC6FF", fontWeight: "900" },

  confirmBox: { backgroundColor: "#11161d", borderWidth: 1, borderColor: "#253041", borderRadius: 12, padding: 12 },
  confirmLine: { color: "#dfe7f3", fontSize: 14, marginBottom: 6 },

  // Create modal
  modalWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#0D0F13" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 6, paddingBottom: 6 },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  modalClose: { color: "#9aa", fontSize: 20, fontWeight: "900" },

  formLabel: { color: "#9aa", marginTop: 8, marginBottom: 6, fontWeight: "700" },
  dualRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  duo: { flex: 1 },
  dualWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, marginBottom: 4 },
  formChipHalf: { width: "49%", height: 50, paddingHorizontal: 12, borderWidth: 2, borderRadius: 12, alignItems: "center" },
  formChipT: { fontWeight: "900", fontSize: 14 },

  toggle: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#161A22", borderWidth: 1, borderColor: "#2A2F38", alignItems: "center" },
  toggleOn: { backgroundColor: "#3A3F4A" },
  toggleT: { color: "#9aa", fontWeight: "800" },
  toggleTOn: { color: "#fff" },

  picker: { height: 44, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#151821", borderWidth: 1, borderColor: "#2A2F38", alignItems: "center", justifyContent: "center" },
  pickerT: { color: "#cfd6e4", fontWeight: "800" },

  input: { backgroundColor: "#151821", color: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#2A2F38", marginBottom: 8 },

  durationGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8, marginBottom: 2 },
  timeChipGrid: { width: "19%", alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: "#1A1D23", borderWidth: 1, borderColor: "#2A2F38" },
  timeChipGridOn: { backgroundColor: "#3A3F4A" },
  timeChipGridT: { color: "#9aa", fontWeight: "800", fontSize: 12 },
  timeChipGridTOn: { color: "#fff" },

  primaryBtn: { backgroundColor: "#3EC6FF", padding: 12, borderRadius: 10, flex: 1 },
  primaryText: { color: "#0D0F13", textAlign: "center", fontWeight: "900" },
  secondaryBtn: { backgroundColor: "#3EC6FF22", borderColor: "#3EC6FF", borderWidth: 1, padding: 12, borderRadius: 10, flex: 1 },
  secondaryText: { color: "#3EC6FF", textAlign: "center", fontWeight: "800" },

  noteBox: { marginTop: 10, backgroundColor: "#151821", borderWidth: 1, borderColor: "#2A2F38", borderRadius: 12, padding: 12, marginHorizontal: 12 },
  note: { color: "#cbd3df", textAlign: "center" },
});
