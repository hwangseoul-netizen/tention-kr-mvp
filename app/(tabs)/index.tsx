// @ts-nocheck
// app/(tabs)/index.tsx  — TENtion KR v1.5.0 (Web/Mobile MVP 안정판)
// ✅ 1:1 완전 제거
// ✅ 인원 제한(max/isFull/Full/disabled) 완전 제거
// ✅ 지역선택 Set 사용 제거 → 배열로 변경(반응성/버그 해결)
// ✅ 체크인 버튼 “항상 반응” (ended/live/upcoming 모두 Alert 처리)
// ✅ 생성 후 “무조건 보이게” (카테고리/지역/스크롤 자동 세팅)
// ✅ Expo Router 템플릿(app/(tabs)/index.tsx)에서 바로 동작

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Alert, Share, Platform, KeyboardAvoidingView
} from "react-native";

/* ✅ Expo Router는 “default export 컴포넌트”만 있으면 됨 */
export default function Screen(){ return <Root/> }

/* =========================
   i18n (KO만 사용)
========================= */
const T = {
  app:"TENtion KR",
  my:"내 모임",
  create:"+ 만들기",
  searchPH:"제목/도시/주제/MBTI 검색…",
  sort:"정렬 기준",
  sortOpt:["마감 임박","최신순","가까운순(예시)","평점순"],
  time:"시간대",
  timeBands:["이른 아침","오전","점심","오후","저녁"],
  distance:"km",
  duration:"분",
  noSlotsT:"표시할 슬롯이 없어요",
  noSlotsS:"반경을 넓히거나, 시간/필터를 조정해봐.",
  details:"자세히",
  checkin:"체크인",
  leave:"나가기",
  share:"공유",
  back:"← 뒤로",
  safetyNote:"밝은 공공장소에서 만나고, DM 금지. 10분 내 결정.",
  cat:{Dating:"Vibe", Friends:"Friends", Workout:"Workout", Talk:"Try"},
  host:{me:"내가 주최", plat:"TENtion 주최"},
  createTitle:"슬롯 만들기",
  category:"카테고리",
  hostLabel:"주최",
  pickCityTime:"도시",
  startEnd:"시작/종료 (24H)",
  title:"제목",
  titlePH:"슬롯 제목",
  desc:"설명",
  descPH:"짧은 설명",
  safetyTips:"안전수칙",
  createCTA:"만들기",
  selectCity:"도시 선택",
  done:"완료",
  live:"진행중",
  ended:"종료",
  multiCity:"지역(복수선택)",
  apply:"적용",
  reset:"초기화",
  regionMore:"지역선택 ▾",
  ok:"OK",
};

/* =========================
   Constants
========================= */
const KM_STEP = 1;
const DUR_OPTS = [10,20,30,40,50,60];

const CATS = [
  {key:"Dating",  label:"Vibe",    icon:"💞", color:"#FF5CAB"},
  {key:"Friends", label:"Friends", icon:"🤝", color:"#2EE778"},
  {key:"Workout", label:"Workout", icon:"💪", color:"#FFA23B"},
  {key:"Talk",    label:"Try",     icon:"🧠", color:"#6AAEFF"},
];

// 대표/전국
const CITY_LIST = [
  {code:"GN",  name:"강남/역삼",   region:"서울"},
  {code:"HD",  name:"홍대/합정",   region:"서울"},
  {code:"JS",  name:"잠실/석촌",   region:"서울"},
  {code:"GS",  name:"성수/건대",   region:"서울"},
  {code:"YD",  name:"여의도",      region:"서울"},
  {code:"SEO", name:"서울(기타)",  region:"서울"},
  {code:"SUW", name:"수원",        region:"경기"},
  {code:"GGN", name:"경기 북부",   region:"경기"},
  {code:"GGS", name:"경기 남부",   region:"경기"},
  {code:"ICN", name:"인천/송도",   region:"수도권"},
  {code:"BUS", name:"부산",        region:"영남"},
  {code:"DG",  name:"대구",        region:"영남"},
  {code:"DJ",  name:"대전",        region:"충청"},
  {code:"GJ",  name:"광주",        region:"호남"},
  {code:"USN", name:"울산",        region:"영남"},
];
const CITY = CITY_LIST.reduce((m,c)=>{ m[c.code]=c; return m; },{});
const cityName = (code)=> CITY[code]?.name || code;
const HOT5 = ["GN","HD","JS","GS","YD"];

/* =========================
   Helpers
========================= */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function parseHM(str){ if(!str||!/^\d{2}:\d{2}$/.test(str)) return null; const [h,m]=str.split(":").map(Number); return h*60+m; }
function spanMins(start,end){ const s=parseHM(start),e=parseHM(end); if(s==null||e==null)return 10; let d=e-s; if(d<=0)d+=1440; return d; }
const fmt24=(str)=>str||"—";
const pad2=(n)=>String(n).padStart(2,"0");
const toTimeString=(m)=>`${Math.floor(m/60)}h ${pad2(m%60)}m`;
const tintByMins=(mins)=> mins<=0?{color:"#666"}: mins<=10?{color:"#FF5A5A",fontWeight:"800"}: mins<=30?{color:"#FF9F1A",fontWeight:"800"}:{color:"#6AAEFF"};
const stars=(n)=>!n?"⭐ —":"⭐".repeat(Math.max(1,Math.min(5,Math.round(n))));
const colorFor=(type)=> type==="Dating"?"#FF5CAB": type==="Friends"?"#2EE778": type==="Workout"?"#FFA23B":"#6AAEFF";
const iconFor =(type)=> type==="Dating"?"💞": type==="Friends"?"🤝": type==="Workout"?"💪":"💬";

/* ===== Details helpers ===== */
const WEEK_KR = ["일","월","화","수","목","금","토"];
function formatKRDate(d=new Date()){
  const y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate(), w=WEEK_KR[d.getDay()];
  return `${y}년 ${m}월 ${day}일 (${w})`;
}
function toAmPm(hm){
  const [hh,mm]=hm.split(":").map(Number);
  const h = ((hh+11)%12)+1; const ampm = hh<12?"AM":"PM";
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")} ${ampm}`;
}
function bandEmoji(band){
  if(band==="이른 아침") return "🌅";
  if(band==="오전")      return "☕";
  if(band==="점심")      return "🍽️";
  if(band==="오후")      return "🌤️";
  return "🌇";
}
const DEFAULT_VIBES = ["따뜻하고 가벼움","차분하고 진지함","에너지 + 집중","담백하고 솔직함"];
function tasksFor(slot){
  if(slot.type==="Workout") return ["간단 스트레칭 공유 🧘‍♂️","오늘 운동 목표 한 가지 💪","10분 피드백 🔄"];
  if(slot.type==="Dating")  return ["첫인상 한 줄 소개 ✨","요즘 꽂힌 것 한 가지 💬","서로 10분 피드백 🔄"];
  if(slot.type==="Friends") return ["가벼운 근황 토크 😊","이번 주 하이라이트 ☀️","서로 팁 하나 공유 💡"];
  return ["오늘 루틴 중 하나 공유 ☀️","요즘 집중하고 싶은 한 가지 💬","10분 안에 서로 피드백 ✨"];
}

/* ---- countdown helpers ---- */
function buildTodayTs(hm){
  const now=new Date();
  const [h,m]=hm.split(":").map(Number);
  return new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m,0).getTime();
}
function getState(nowMs, startHM, durMin){
  const start = buildTodayTs(startHM);
  const end   = start + durMin*60*1000;
  if(nowMs < start) return {state:"upcoming", secsToStart: Math.floor((start-nowMs)/1000)};
  if(nowMs <= end)  return {state:"live", secsToStart:0};
  return {state:"ended", secsToStart:0};
}
function fmtHMS(secs){
  const h=Math.floor(secs/3600);
  const m=Math.floor((secs%3600)/60);
  const s=secs%60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
const uniq = (arr)=> Array.from(new Set(arr));
const includes = (arr, v)=> (arr||[]).includes(v);

/* =========================
   Auto Slot Generator (KR)
========================= */
const BAND_ANCHOR = { "이른 아침":"06:30","오전":"10:00","점심":"13:00","오후":"16:00","저녁":"19:30" };
function guessBandFromStart(hm){
  const m=parseHM(hm)||0,h=Math.floor(m/60);
  if(h<9) return "이른 아침"; if(h<12) return "오전"; if(h<15) return "점심"; if(h<19) return "오후"; return "저녁";
}
function weightedPick(list, wts){
  if(!wts || wts.length!==list.length){ return list[Math.floor(Math.random()*list.length)]; }
  const sum=wts.reduce((a,b)=>a+b,0); let r=Math.random()*sum;
  for(let i=0;i<list.length;i++){ if((r-=wts[i])<=0) return list[i]; }
  return list[list.length-1];
}
function addMin(startHM, delta){
  const m=(parseHM(startHM)||0)+delta; const mm=((m%1440)+1440)%1440;
  return `${pad2(Math.floor(mm/60))}:${pad2(mm%60)}`;
}

// 장소 샘플
const KR_PLACES = {
  SEO:["성수 카페거리","한강 뚝섬","잠실 롯데월드몰","강남역 로비","홍대 놀이터","여의도 공원"],
  GN:["삼성역 코엑스몰","선릉 공원","역삼 로비"],
  HD:["홍대입구 9번","합정 메세나폴리스","망원 한강"],
  JS:["석촌호수","잠실새내","잠실운동장 앞"],
  GS:["성수연방","서울숲 벤치","건대입구 로터리"],
  YD:["IFC몰 로비","63빌딩 앞","여의서로 산책로"],
  ICN:["송도 센트럴파크","인천대공원"],
  GGN:["일산 호수공원","의정부역 광장"],
  GGS:["분당 정자역","판교 알파돔"],
  SUW:["수원역 AK앞","광교 호수공원"],
  BUS:["광안리 해변","해운대 블루라인"],
  DG:["동성로 거리","수성못"],
  DJ:["둔산 타임월드"],
  GJ:["충장로"],
  USN:["태화강 국가정원"]
};

const TRY_TOPICS = ["멘탈/회복","자기계발","책 토크","창업/비즈","마케팅","성장통","커리어","대인관계","여행","스포츠","OTT/영화","MBTI","연애상담"];
const AGE_BUCKETS = [[18,24],[25,34],[35,44],[45,54]];

function generateKRSlots({ cityCode="GN", band="저녁", count=20 }){
  const list=[];
  const places = KR_PLACES[cityCode] || KR_PLACES["SEO"];
  const anchor = BAND_ANCHOR[band] || "18:00";
  const cats=["Dating","Friends","Workout","Talk"];
  const wts = band==="이른 아침"?[1,2,4,2]: band==="오전"?[2,3,2,3]: band==="점심"?[2,3,1,4]: band==="오후"?[3,2,2,3]: [3,2,1,4];

  for(let i=0;i<count;i++){
    const type = weightedPick(cats, wts);
    const place = places[Math.floor(Math.random()*places.length)];
    const d = DUR_OPTS[Math.floor(Math.random()*DUR_OPTS.length)];
    const start = addMin(anchor, 10 * Math.floor(Math.random()*18));
    const end = addMin(start, d);
    const tb = guessBandFromStart(start);
    const topic = (type==="Talk") ? TRY_TOPICS[Math.floor(Math.random()*TRY_TOPICS.length)] : null;
    const age  = AGE_BUCKETS[Math.floor(Math.random()*AGE_BUCKETS.length)];
    const minsLeft = Math.max(5, Math.floor(spanMins(start,end)*0.8));

    list.push({
      id: Date.now()+Math.floor(Math.random()*1e6),
      type, city:cityCode, band:tb,
      title: `${place} • ${type==="Talk" ? (topic||"Try") : (T.cat[type]||type)}`,
      start, end, totalMins: spanMins(start,end),
      minsLeft,
      attendees:[],
      desc: (type==="Talk") ? "정직하게, 짧게. 10분 토크." : "가볍게 만나요. 공공장소 필수.",
      proofScore: Math.round(3 + Math.random()*2),
      hostType:"platform",
      ageRange: age,
      vibe: DEFAULT_VIBES[Math.floor(Math.random()*DEFAULT_VIBES.length)]
    });
  }
  return list.sort((a,b)=>b.id-a.id);
}

/* =========================
   Root
========================= */
const ME = "You";

function Root(){
  const t=T;
  const [nowMs,setNowMs]=useState(Date.now());
  useEffect(()=>{ const id=setInterval(()=>setNowMs(Date.now()),1000); return ()=>clearInterval(id); },[]);

  // filters
  const [activeCat,setActiveCat]=useState("");
  const [radius,setRadius]=useState(5);
  const [dur,setDur]=useState(10);
  const [sortBy,setSortBy]=useState(t.sortOpt[0]);

  // 시간대
  const [band,setBand]=useState(t.timeBands[4]);

  // ✅ 지역 선택: Array
  const [selectedCities,setSelectedCities]=useState(HOT5);

  const toggleCity=(code)=>{
    setSelectedCities(prev=>{
      const has = prev.includes(code);
      const next = has ? prev.filter(x=>x!==code) : [...prev, code];
      return next;
    });
  };

  const [showCitySheet,setShowCitySheet]=useState(false);
  const [showSortSheet,setShowSortSheet]=useState(false);
  const [myOnly,setMyOnly]=useState(false);
  const [search,setSearch]=useState("");
  const scrollRef=useRef(null);

  // slots
  const [slots,setSlots]=useState([]);

  useEffect(()=>{
    const base = selectedCities.length ? selectedCities : HOT5;
    const per  = Math.max(10, Math.floor(48 / base.length));
    const packs = base.flatMap(code=>generateKRSlots({ cityCode:code, band, count:per }));
    setSlots(packs.slice(0,72));
  },[band, selectedCities]);

  const resetHome=()=>{
    setActiveCat("");
    setRadius(5);
    setDur(10);
    setSortBy(t.sortOpt[0]);
    setSearch("");
    setMyOnly(false);
    setSelectedCities(HOT5);
    scrollRef.current?.scrollTo({y:0,animated:true});
  };

  const list = useMemo(()=>{
    let arr = slots.slice();

    if(activeCat) arr = arr.filter(s=>s.type===activeCat);

    const cities = selectedCities.length ? selectedCities : HOT5;
    arr = arr.filter(s=> includes(cities, s.city));

    arr = arr.filter(s => (s.totalMins||10) >= dur);

    if(myOnly) arr = arr.filter(s => includes(s.attendees, ME) || s.hostType==="me");

    if(search.trim()){
      const q=search.trim().toLowerCase();
      arr = arr.filter(s=>{
        const txt = `${s.title} ${s.type} ${cityName(s.city)} ${s.band}`.toLowerCase();
        return txt.includes(q);
      });
    }

    if(sortBy===t.sortOpt[0]) arr.sort((a,b)=>(a.minsLeft||1e9)-(b.minsLeft||1e9));
    if(sortBy===t.sortOpt[1]) arr.sort((a,b)=>b.id-a.id);
    if(sortBy===t.sortOpt[3]) arr.sort((a,b)=>(b.proofScore||0)-(a.proofScore||0));

    return arr;
  },[slots,activeCat,dur,sortBy,selectedCities,search,myOnly]);

  const [screen,setScreen]=useState("home");
  const [selId,setSelId]=useState(null);

  const join=(slot)=>{
    if(!slot) return;

    const {state} = getState(nowMs, slot.start, slot.totalMins || 10);
    if(state==="ended"){
      Alert.alert("종료됨","이미 종료된 모임이야.");
      return;
    }
    if(state==="live"){
      Alert.alert("진행중","이미 시작된 모임이야. 그래도 합류는 가능해(테스트용).");
    }

    setSlots(prev=>prev.map(s=>{
      if(s.id!==slot.id) return s;
      const already = includes(s.attendees, ME);
      const nextAtt = already ? s.attendees : [...(s.attendees||[]), ME];
      return {...s, attendees: nextAtt};
    }));

    Alert.alert("체크인","완료");
  };

  const leave=(slot)=>{
    if(!slot) return;
    setSlots(prev=>prev.map(s=>{
      if(s.id!==slot.id) return s;
      return {...s, attendees:(s.attendees||[]).filter(x=>x!==ME)};
    }));
    Alert.alert("나가기","완료");
  };

  const shareSlot=async(slot)=>{
    if(!slot) return;
    try{
      if(Platform.OS === "web"){
        Alert.alert("공유", `복사해서 공유해줘:\nTENtion • ${slot.title}`);
        return;
      }
      await Share.share({message:`TENtion • ${slot.title}\n${T.cat[slot.type]||slot.type} @ ${cityName(slot.city)} • ${slot.band}`});
    }catch(e){}
  };

  // Create form
  const [createOpen,setCreateOpen]=useState(false);
  const [form,setForm]=useState({
    cat:"",
    host:T.host.me,
    city:"GN",
    start:"18:00",
    end:"18:10",
    dur:10,
    title:"",
    desc:"",
    _cityPick:false
  });

  const openCreate=()=>{
    const firstSel = selectedCities[0] || "GN";
    setForm(f=>({
      ...f,
      cat: activeCat || "",
      city: firstSel,
      dur:10,
      start:"18:00",
      end:"18:10",
      _cityPick:false
    }));
    setCreateOpen(true);
  };

  const createSlot=()=>{
    const mins = clamp(form.dur,10,100);
    const st = parseHM(form.start) ?? (18*60);
    const enHM = (st + mins) % 1440;
    const end = `${pad2(Math.floor(enHM/60))}:${pad2(enHM%60)}`;
    const mappedHost = (form.host===T.host.plat) ? "platform" : "me";

    const cat = form.cat || "Talk";
    const city = form.city || "GN";

    const s = {
      id: Date.now()+Math.floor(Math.random()*1e6),
      type: cat,
      hostType: mappedHost,
      city,
      band: guessBandFromStart(form.start),
      title: (form.title || defaultTitle(cat)).trim(),
      start: form.start,
      end,
      totalMins: mins,
      minsLeft: Math.max(5, Math.floor(mins*0.8)),
      attendees: [],
      desc: (form.desc || defaultDesc(cat)).trim(),
      proofScore:0,
      vibe: DEFAULT_VIBES[Math.floor(Math.random()*DEFAULT_VIBES.length)]
    };

    setSlots(prev=>[s, ...prev]);
    setCreateOpen(false);

    setActiveCat(cat);
    setSelectedCities(prev=>{
      const next = prev.includes(city) ? prev : [...prev, city];
      return uniq(next);
    });

    setTimeout(()=>scrollRef.current?.scrollTo({y:0,animated:true}), 50);
    Alert.alert("생성 완료","피드 최상단에 추가됨");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={resetHome} style={{flexDirection:"row",alignItems:"flex-end"}} hitSlop={10}>
          <Text style={styles.logo}>{t.app}</Text>
        </TouchableOpacity>

        <View style={{flexDirection:"row",gap:8,alignItems:"center"}}>
          <TouchableOpacity
            style={[styles.secondarySm, myOnly && styles.secondarySmOn]}
            onPress={()=>setMyOnly(v=>!v)}
          >
            <Text style={[styles.secondarySmT, myOnly && styles.secondarySmTOn]}>{t.my}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primarySm} onPress={openCreate}>
            <Text style={styles.primarySmT}>{t.create}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{paddingBottom:80}}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
      >
        {/* CATEGORIES */}
        <View style={styles.catRow}>
          {CATS.map(c=>{
            const on = activeCat===c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={()=>setActiveCat(p=>p===c.key?"":c.key)}
                style={[
                  styles.catChip,
                  {borderColor:c.color},
                  on && {backgroundColor:c.color+"22"}
                ]}
              >
                <Text style={[styles.catText,{color:c.color}]} numberOfLines={1} ellipsizeMode="tail">
                  {c.icon} {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Row: distance • duration • sort */}
        <View style={styles.row3}>
          <Stepper
            label={t.distance}
            value={radius}
            onMinus={()=>setRadius(clamp(radius-KM_STEP,1,50))}
            onPlus={()=>setRadius(clamp(radius+KM_STEP,1,50))}
          />
          <Stepper
            label={t.duration}
            value={dur}
            step={10}
            onMinus={()=>setDur(clamp(dur-10,10,100))}
            onPlus={()=>setDur(clamp(dur+10,10,100))}
          />
          <TouchableOpacity style={styles.sortBtn} onPress={()=>setShowSortSheet(true)}>
            <Text style={styles.sortBtnT} numberOfLines={1}>{t.sort}</Text>
          </TouchableOpacity>
        </View>

        {/* 시간대 */}
        <View style={styles.bandRow}>
          {T.timeBands.map(b=>(
            <TouchableOpacity
              key={b}
              onPress={()=>setBand(b)}
              style={[styles.bandChip, band===b && styles.bandChipOn]}
            >
              <Text style={[styles.bandChipT, band===b && styles.bandChipTOn]} numberOfLines={1}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 핫 지역 5 + 지역선택 */}
        <View style={styles.hotRow}>
          {HOT5.map(code=>{
            const on = selectedCities.includes(code);
            return (
              <TouchableOpacity
                key={code}
                onPress={()=>toggleCity(code)}
                style={[styles.cityChip, on && styles.cityChipActive]}
              >
                <Text style={[styles.cityChipT, on && styles.cityChipTActive]} numberOfLines={1}>
                  {cityName(code)}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.moreChip} onPress={()=>setShowCitySheet(true)}>
            <Text style={styles.moreChipT} numberOfLines={1}>{T.regionMore}</Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchPH}
          placeholderTextColor="#7a8596"
          style={styles.search}
        />

        {/* FEED */}
        {list.length===0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyT}>{t.noSlotsT}</Text>
            <Text style={styles.emptyS}>{t.noSlotsS}</Text>
          </View>
        )}

        {list.map(s=>(
          <Card
            key={s.id}
            slot={s}
            nowMs={nowMs}
            onDetails={()=>{ setSelId(s.id); setScreen("detail"); }}
            onPrimary={()=> join(s)}
          />
        ))}

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
          onPick={(v)=>{ setSortBy(v); setShowSortSheet(false); }}
          onCancel={()=>setShowSortSheet(false)}
        />
      )}

      {/* MULTI CITY SHEET */}
      {showCitySheet && (
        <MultiCitySheet
          currentList={selectedCities}
          onApply={(codes)=>{ setSelectedCities(codes); setShowCitySheet(false); }}
          onClose={()=>setShowCitySheet(false)}
        />
      )}

      {/* CREATE */}
      {createOpen && (
        <CreateModal
          form={form}
          setForm={setForm}
          onClose={()=>setCreateOpen(false)}
          onCreate={createSlot}
        />
      )}

      {/* DETAILS */}
      {screen==="detail" && selId && (
        <Details
          slot={slots.find(s=>s.id===selId)}
          nowMs={nowMs}
          onBack={()=>setScreen("home")}
          onShare={()=>shareSlot(slots.find(s=>s.id===selId))}
          onJoin={()=>join(slots.find(s=>s.id===selId))}
          onLeave={()=>leave(slots.find(s=>s.id===selId))}
        />
      )}
    </SafeAreaView>
  );
}

/* =========================
   UI Components
========================= */
function Stepper({label,value,step=1,onMinus,onPlus}){
  return(
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={onMinus} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Text style={styles.stepBtnT}>−</Text>
      </TouchableOpacity>
      <View style={styles.stepMid}>
        <Text style={styles.stepVal} numberOfLines={1}>{value}</Text>
        <Text style={styles.stepLbl} numberOfLines={1}>{label}</Text>
      </View>
      <TouchableOpacity style={styles.stepBtn} onPress={onPlus} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <Text style={styles.stepBtnT}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

function Card({slot,onDetails,onPrimary,nowMs}){
  if(!slot) return null;
  const {state, secsToStart} = getState(nowMs, slot.start, slot.totalMins || 10);
  const tint  = tintByMins(slot.minsLeft || 10);
  const ratio = (slot.totalMins || 10) ? Math.max(0, (slot.minsLeft||0))/(slot.totalMins||10) : 0;

  const rightBadge = (
    state==="upcoming"
      ? <MiniBadge text={`⏳ ${fmtHMS(secsToStart)}`} tone="#3EC6FF"/>
      : state==="live"
        ? <MiniBadge text={T.live} tone="#2EE778"/>
        : <MiniBadge text={T.ended} tone="#666"/>
  );

  return(
    <View style={[styles.card,{borderColor:colorFor(slot.type)}]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardType,{color:colorFor(slot.type)}]} numberOfLines={1}>
          {iconFor(slot.type)} {T.cat[slot.type] || slot.type}  •  {cityName(slot.city)}  •  {slot.band}
        </Text>
        <View style={{flexDirection:"row",gap:6,alignItems:"center"}}>
          {rightBadge}
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{slot.title}</Text>
      <Text style={styles.cardLine}>
        🕒 {fmt24(slot.start)} ~ {fmt24(slot.end)} • {Math.max(10,slot.totalMins||10)}분 • <Text style={tint}>{toTimeString(slot.minsLeft||0)}</Text>
      </Text>
      <Text style={styles.cardLine}>👥 {slot.attendees?.length || 0}명 • {stars(slot.proofScore)}</Text>

      <View style={styles.progOuter}>
        <View style={[styles.progInner,{width:`${Math.max(4,ratio*100)}%`, backgroundColor:tint.color||"#6AAEFF"}]} />
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>{slot.desc}</Text>

      <View style={styles.cardFoot}>
        <TouchableOpacity style={styles.outBtn} onPress={onDetails}>
          <Text style={styles.outBtnT}>{T.details}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.inBtn} onPress={onPrimary}>
          <Text style={styles.inBtnT}>{T.checkin}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Details({slot,onBack,onShare,onJoin,onLeave,nowMs}){
  if(!slot) return null;
  const joined = (slot.attendees||[]).includes(ME);
  const {state, secsToStart} = getState(nowMs, slot.start, slot.totalMins || 10);
  const labelTone = state==="live" ? "#2EE778" : (state==="upcoming" ? "#3EC6FF" : "#666");
  const labelText = state==="upcoming" ? `⏳ ${fmtHMS(secsToStart)}` : (state==="live" ? T.live : T.ended);

  const vibe = slot.vibe || DEFAULT_VIBES[Math.floor(Math.random()*DEFAULT_VIBES.length)];
  const hostLabel = slot.hostType==="platform" ? "TENtion Korea" : "User Host";
  const cityLabel = cityName(slot.city);
  const dateStr = formatKRDate(new Date());
  const startAmPm = toAmPm(slot.start);
  const minText = (slot.totalMins||10)>=20 ? `최소 ${slot.totalMins}분` : `${slot.totalMins||10}분`;
  const ageText = slot.ageRange ? `${slot.ageRange[0]}–${slot.ageRange[1]}세` : "전 연령";

  const placeTitle = (slot.title||"").split(" • ")[0] || cityLabel;
  const tint   = tintByMins(slot.minsLeft || 0);
  const ratio  = (slot.totalMins||10) ? Math.max(0, (slot.minsLeft||0))/(slot.totalMins||10) : 0;

  return(
    <View style={styles.detailWrap}>
      <SafeAreaView />
      <ScrollView contentContainerStyle={{padding:18,paddingBottom:120}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>{T.back}</Text>
        </TouchableOpacity>

        <View style={[styles.detailsBox,{borderColor:colorFor(slot.type)}]}>
          <View style={styles.badgeRow}>
            <MiniBadge text={`${iconFor(slot.type)} ${T.cat[slot.type] || slot.type}`} tone={colorFor(slot.type)} />
            <MiniBadge text={labelText} tone={labelTone} />
          </View>

          <Text style={[styles.detailsTitle,{color:colorFor(slot.type)}]} numberOfLines={3}>
            {slot.title}
          </Text>

          <Text style={[styles.subBy]} numberOfLines={1}>
            💎 Hosted by <Text style={{fontWeight:"900"}}>{hostLabel}</Text>
          </Text>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLine}>
              {bandEmoji(slot.band)}  {slot.band} — <Text style={{fontWeight:"900"}}>Start {startAmPm}</Text> • Duration <Text style={{fontWeight:"900"}}>{minText}</Text>
            </Text>
            <Text style={styles.infoLine}>📅 날짜: {dateStr} — {cityLabel}</Text>
            <Text style={styles.infoLine}>👥 참여자 {slot.attendees?.length || 0}명  🎯 분위기 {vibe}</Text>
            <Text style={styles.infoLine}>🔢 연령대 {ageText}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>📝 우리가 할 일</Text>
            {tasksFor(slot).map((tx,i)=>(
              <Text key={i} style={styles.taskLine}>{["1️⃣","2️⃣","3️⃣"][i]||"•"} {tx}</Text>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>📍 장소</Text>
            <Text style={styles.placeLine}>{placeTitle} • {cityLabel}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>⏱️ 진행상황</Text>
            <Text style={styles.cardLine}>
              🕒 {fmt24(slot.start)} ~ {fmt24(slot.end)} • <Text style={tint}>{toTimeString(slot.minsLeft||0)}</Text>
            </Text>
            <View style={styles.progOuter}>
              <View style={[styles.progInner,{width:`${Math.max(4,ratio*100)}%`, backgroundColor:tint.color||"#6AAEFF"}]} />
            </View>
          </View>

          <View style={styles.policyBox}>
            <Text style={styles.secTitle}>✅ TENtion 방침</Text>
            <Text style={styles.policyLine}>• 공공장소 only  • DM 금지  • 언제든 퇴장 가능  • 예의 필수  • 결제 없음</Text>
          </View>

          <View style={{flexDirection:"row",gap:10,marginTop:12}}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onShare}>
              <Text style={styles.secondaryText}>{T.share}</Text>
            </TouchableOpacity>

            {!joined && (
              <TouchableOpacity style={styles.primaryBtn} onPress={onJoin}>
                <Text style={styles.primaryText}>{T.checkin}</Text>
              </TouchableOpacity>
            )}

            {joined && (
              <TouchableOpacity style={[styles.secondaryBtn,{borderColor:"#FF5A5A",backgroundColor:"#FF5A5A22"}]} onPress={onLeave}>
                <Text style={[styles.secondaryText,{color:"#FF5A5A"}]}>{T.leave}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function MiniBadge({text,tone}){
  return(
    <View style={[styles.miniBadge,{backgroundColor:tone+"22",borderColor:tone}]}>
      <Text style={[styles.miniBadgeT,{color:tone}]}>{text}</Text>
    </View>
  );
}

function ActionSheet({title,value,options,onPick,onCancel}){
  return(
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{flex:1}} onPress={onCancel} />
      <View style={styles.sheetCard}>
        <View style={styles.sheetHandle}/>
        <Text style={styles.sheetTitle}>{title}</Text>
        {options.map(opt=>(
          <TouchableOpacity key={opt} style={styles.sheetItem} onPress={()=>onPick(opt)}>
            <Text style={[styles.sheetItemT, value===opt && {color:"#3EC6FF"}]}>
              {opt}{value===opt?" •":""}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.primaryBtn,{marginTop:6}]} onPress={onCancel}>
          <Text style={styles.primaryText}>{T.ok}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MultiCitySheet({currentList,onApply,onClose}){
  const [local,setLocal]=useState(uniq(currentList || []));
  const toggle=(code)=> setLocal(prev=>{
    const has = prev.includes(code);
    return has ? prev.filter(x=>x!==code) : [...prev, code];
  });
  const apply=()=> onApply(uniq(local));
  const reset=()=> setLocal([]);

  const groups = {};
  CITY_LIST.forEach(c=>{
    const g = c.region || "기타";
    if(!groups[g]) groups[g]=[];
    groups[g].push(c);
  });

  return(
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{flex:1}} onPress={onClose} />
      <View style={styles.sheetCardTall}>
        <View style={styles.sheetHandle}/>
        <Text style={styles.sheetTitle}>{T.multiCity}</Text>

        <ScrollView style={{maxHeight:420}} showsVerticalScrollIndicator={false} overScrollMode="never">
          {Object.keys(groups).map(gr=>(
            <View key={gr} style={{marginBottom:8}}>
              <Text style={{color:"#9aa",marginBottom:6,fontWeight:"800"}}>{gr}</Text>
              {groups[gr].map(c=>{
                const on = local.includes(c.code);
                return (
                  <TouchableOpacity key={c.code} style={styles.cityRow} onPress={()=>toggle(c.code)}>
                    <View style={[styles.chk, on && styles.chkOn]}>
                      <Text style={[styles.chkT, on && styles.chkTOn]}>✓</Text>
                    </View>
                    <Text style={[styles.cityRowT, on && {color:"#3EC6FF"}]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={{flexDirection:"row",gap:8,marginTop:10,justifyContent:"flex-end"}}>
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

function CreateModal({form,setForm,onClose,onCreate}){
  const setDur=(v)=>setForm(f=>({...f,dur:clamp(v,10,100), end: f.start}));

  return(
    <View style={styles.modalWrap}>
      <SafeAreaView />
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{T.createTitle}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{flex:1}} contentContainerStyle={{padding:14,paddingBottom:120}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.formLabel}>{T.category}</Text>
          <View style={styles.dualWrap}>
            {CATS.map(c=>(
              <TouchableOpacity
                key={c.key}
                onPress={()=>setForm(f=>({...f,cat:f.cat===c.key?"":c.key}))}
                style={[
                  styles.formChipHalf,
                  {borderColor:c.color, justifyContent:"center"},
                  form.cat===c.key && {backgroundColor:c.color+"22"}
                ]}
              >
                <Text style={[styles.formChipT,{color:c.color,textAlign:"center"}]} numberOfLines={1}>
                  {c.icon} {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>{T.hostLabel}</Text>
          <View style={styles.dualRow}>
            {[T.host.me, T.host.plat].map(h=>(
              <TouchableOpacity
                key={h}
                onPress={()=>setForm(f=>({...f,host:h}))}
                style={[styles.toggle, form.host===h && styles.toggleOn]}
              >
                <Text style={[styles.toggleT, form.host===h && styles.toggleTOn]} numberOfLines={1}>{h}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>{T.pickCityTime}</Text>
          <View style={styles.dualRow}>
            <Picker button={"도시"} value={cityName(form.city)} onPress={()=>setForm(f=>({...f, _cityPick:true}))} />
          </View>

          {form._cityPick && (
            <CitySheetSingle
              current={form.city}
              onPick={(v)=>setForm(f=>({...f,city:v,_cityPick:false}))}
              onClose={()=>setForm(f=>({...f,_cityPick:false}))}
            />
          )}

          <Text style={styles.formLabel}>{T.startEnd}</Text>
          <View style={styles.dualRow}>
            <TextInput
              style={[styles.input,styles.duo]}
              placeholder="HH:MM"
              placeholderTextColor="#738"
              value={form.start}
              onChangeText={t=>setForm(f=>({...f,start:t}))}
            />
            <TextInput
              style={[styles.input,styles.duo]}
              placeholder="HH:MM"
              placeholderTextColor="#738"
              value={form.end}
              onChangeText={t=>setForm(f=>({...f,end:t}))}
            />
          </View>

          <Text style={styles.formLabel}>진행시간</Text>
          <View style={styles.durationGrid}>
            {DUR_OPTS.map(n=>(
              <TouchableOpacity
                key={n}
                style={[styles.timeChipGrid, form.dur===n && styles.timeChipGridOn]}
                onPress={()=>setDur(n)}
              >
                <Text style={[styles.timeChipGridT, form.dur===n && styles.timeChipGridTOn]}>{n} 분</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>{T.title}</Text>
          <TextInput
            style={styles.input}
            placeholder={T.titlePH}
            placeholderTextColor="#738"
            value={form.title}
            onChangeText={v=>setForm(f=>({...f,title:v}))}
          />

          <Text style={styles.formLabel}>{T.desc}</Text>
          <TextInput
            style={[styles.input,{minHeight:130}]}
            multiline
            placeholder={T.descPH}
            placeholderTextColor="#738"
            value={form.desc}
            onChangeText={v=>setForm(f=>({...f,desc:v}))}
          />

          <View style={{flexDirection:"row",gap:8,marginTop:10}}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={()=>{ Alert.alert("안전","밝은 공공장소에서 만나고, 지인에게 일정을 공유해줘."); }}>
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

function CitySheetSingle({current,onPick,onClose}){
  return(
    <View style={styles.sheetWrap}>
      <TouchableOpacity style={{flex:1}} onPress={onClose} />
      <View style={styles.sheetCardTall}>
        <View style={styles.sheetHandle}/>
        <Text style={styles.sheetTitle}>{T.selectCity}</Text>
        <ScrollView style={{maxHeight:420}} showsVerticalScrollIndicator={false} overScrollMode="never">
          {CITY_LIST.map(c=>(
            <TouchableOpacity key={c.code} style={styles.cityRow} onPress={()=>onPick(c.code)}>
              <Text style={[styles.cityRowT, current===c.code && {color:"#3EC6FF"}]} numberOfLines={1}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={[styles.primaryBtn,{marginTop:10}]} onPress={onClose}>
          <Text style={styles.primaryText}>{T.done}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Picker({button,value,onPress}){
  return(
    <TouchableOpacity style={[styles.picker, styles.duo]} onPress={onPress}>
      <Text style={styles.pickerT} numberOfLines={1}>
        {button}: <Text style={{color:"#fff"}}>{value}</Text>
      </Text>
    </TouchableOpacity>
  );
}

function defaultTitle(cat){
  if(cat==="Dating")  return "Vibe • 10";
  if(cat==="Friends") return "Friends • 10";
  if(cat==="Workout") return "Workout • 10";
  return "Try • 10";
}
function defaultDesc(cat){
  if(cat==="Dating")  return "짧게 만나고, 가볍게 대화해요.";
  if(cat==="Friends") return "부담 없이 합류해요.";
  if(cat==="Workout") return "가볍게 움직이고 리프레시.";
  return               "정직하게, 짧게. 10분 토크.";
}

/* =========================
   Styles
========================= */
const CONTROL_H = 44;

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#0D0F13"},

  headerRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:12,paddingTop:6,marginBottom:6},
  logo:{color:"#fff",fontSize:28,fontWeight:"900"},
  primarySm:{backgroundColor:"#3EC6FF",paddingVertical:9,paddingHorizontal:12,borderRadius:12},
  primarySmT:{color:"#0D0F13",fontWeight:"900"},
  secondarySm:{backgroundColor:"#3EC6FF22",borderWidth:1,borderColor:"#3EC6FF",paddingVertical:9,paddingHorizontal:12,borderRadius:12},
  secondarySmOn:{backgroundColor:"#3EC6FF"},
  secondarySmT:{color:"#3EC6FF",fontWeight:"800"},
  secondarySmTOn:{color:"#0D0F13",fontWeight:"900"},

  catRow:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:12,marginBottom:8},
  catChip:{width:"23.5%",paddingVertical:10,paddingHorizontal:8,borderWidth:2,borderRadius:14,alignItems:"center",justifyContent:"center"},
  catText:{fontWeight:"900",fontSize:13},

  row3:{flexDirection:"row",gap:8,marginBottom:8,paddingHorizontal:12},
  stepper:{
    flex:1, height:CONTROL_H, borderRadius:12, backgroundColor:"#161A22",
    borderWidth:1, borderColor:"#2A2F38", flexDirection:"row", overflow:"hidden"
  },
  stepBtn:{width:48, alignItems:"center", justifyContent:"center"},
  stepBtnT:{color:"#fff",fontSize:18,fontWeight:"900"},
  stepMid:{flex:1, alignItems:"center", justifyContent:"center", borderLeftWidth:1, borderRightWidth:1, borderColor:"#2A2F38"},
  stepVal:{color:"#fff",fontWeight:"900",fontSize:16,lineHeight:18},
  stepLbl:{color:"#9aa",fontWeight:"700",fontSize:11,marginTop:2},

  sortBtn:{width:110, height:CONTROL_H, borderRadius:12, backgroundColor:"#161A22", borderWidth:1, borderColor:"#2A2F38", alignItems:"center", justifyContent:"center"},
  sortBtnT:{color:"#fff",fontWeight:"900",fontSize:13},

  bandRow:{flexDirection:"row",justifyContent:"space-between",gap:6,marginBottom:8,paddingHorizontal:12},
  bandChip:{flexBasis:"19%",height:36,borderRadius:10,backgroundColor:"#151821",borderWidth:1,borderColor:"#2A2F38",alignItems:"center",justifyContent:"center"},
  bandChipOn:{backgroundColor:"#3A3F4A"},
  bandChipT:{color:"#9aa",fontWeight:"800",fontSize:12},
  bandChipTOn:{color:"#fff"},

  hotRow:{flexDirection:"row",justifyContent:"space-between",gap:6,marginBottom:8,paddingHorizontal:12},
  cityChip:{flexBasis:"16%",height:36,paddingHorizontal:6,borderRadius:10,backgroundColor:"#151821",borderWidth:1,borderColor:"#2A2F38",alignItems:"center",justifyContent:"center"},
  cityChipActive:{backgroundColor:"#3A3F4A"},
  cityChipT:{color:"#9aa",fontWeight:"800",fontSize:12},
  cityChipTActive:{color:"#fff"},
  moreChip:{flexBasis:"16%",height:36,paddingHorizontal:6,borderRadius:10,backgroundColor:"#151821",borderWidth:1,borderColor:"#2A2F38",alignItems:"center",justifyContent:"center"},
  moreChipT:{color:"#ddd",fontWeight:"800",fontSize:12},

  search:{backgroundColor:"#141821",color:"#fff",padding:12,borderRadius:12,borderWidth:1,borderColor:"#232833",marginBottom:8,marginHorizontal:12},

  empty:{padding:14,borderRadius:12,backgroundColor:"#151821",borderWidth:1,borderColor:"#2A2F38",marginTop:4,marginHorizontal:12},
  emptyT:{color:"#fff",fontWeight:"900",marginBottom:4},
  emptyS:{color:"#9aa"},

  card:{borderWidth:2,borderRadius:12,padding:12,marginBottom:10,marginHorizontal:12},
  cardHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  cardType:{fontWeight:"900",fontSize:12,maxWidth:"70%"},
  cardTitle:{color:"#fff",fontSize:17,fontWeight:"900",marginBottom:4},
  cardLine:{color:"#bbb",fontSize:12,marginBottom:4},
  cardDesc:{color:"#cfe8cf",fontSize:12,marginTop:2},
  progOuter:{height:6,backgroundColor:"#1A1D23",borderRadius:6,overflow:"hidden",marginBottom:6,marginTop:2},
  progInner:{height:6,borderRadius:6},
  cardFoot:{flexDirection:"row",gap:10,marginTop:8},
  outBtn:{borderWidth:1,borderColor:"#555",paddingVertical:8,paddingHorizontal:14,borderRadius:10},
  outBtnT:{color:"#ddd",fontWeight:"800",fontSize:12},
  inBtn:{backgroundColor:"#3EC6FF",paddingVertical:8,paddingHorizontal:14,borderRadius:10},
  inBtnT:{color:"#0D0F13",fontWeight:"900",fontSize:12},

  detailWrap:{position:"absolute",left:0,right:0,top:0,bottom:0,backgroundColor:"#0D0F13"},
  back:{color:"#9aa",marginBottom:12,fontSize:14},
  detailsBox:{borderWidth:2,borderRadius:14,padding:16},
  detailsTitle:{fontSize:22,fontWeight:"900",marginBottom:8},
  subBy:{color:"#dfe7f3",marginTop:2,marginBottom:10},
  badgeRow:{flexDirection:"row",gap:8,marginBottom:8},
  miniBadge:{borderWidth:1,paddingVertical:2,paddingHorizontal:8,borderRadius:8},
  miniBadgeT:{fontSize:11,fontWeight:"800"},

  infoBlock:{backgroundColor:"#11161d",borderWidth:1,borderColor:"#253041",borderRadius:12,padding:12,marginTop:4},
  infoLine:{color:"#dfe7f3",marginBottom:6,fontSize:14},
  section:{marginTop:12},
  secTitle:{color:"#fff",fontWeight:"900",marginBottom:6,fontSize:16},
  taskLine:{color:"#e7f1ff",marginBottom:4,fontSize:14,lineHeight:20},
  placeLine:{color:"#dfe",marginBottom:4,fontSize:14},
  policyBox:{backgroundColor:"#101820",borderWidth:1,borderColor:"#2A3748",borderRadius:12,padding:12,marginTop:10},
  policyLine:{color:"#cbd3df",fontSize:13},

  sheetWrap:{position:"absolute",left:0,right:0,top:0,bottom:0,backgroundColor:"#0009",justifyContent:"flex-end"},
  sheetCard:{backgroundColor:"#151821",borderTopLeftRadius:16,borderTopRightRadius:16,padding:14,borderWidth:1,borderColor:"#2A2F38"},
  sheetCardTall:{backgroundColor:"#151821",borderTopLeftRadius:16,borderTopRightRadius:16,padding:14,borderWidth:1,borderColor:"#2A2F38",maxHeight:520},
  sheetHandle:{width:44,height:4,backgroundColor:"#2A2F38",borderRadius:2,alignSelf:"center",marginBottom:10},
  sheetTitle:{color:"#fff",fontSize:18,fontWeight:"900",marginBottom:8},
  sheetItem:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#262B35"},
  sheetItemT:{color:"#cfd6e4",fontSize:16,fontWeight:"800"},
  cityRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#262B35"},
  cityRowT:{color:"#cfd6e4",fontSize:16,fontWeight:"800"},
  chk:{width:20,height:20,borderRadius:6,borderWidth:2,borderColor:"#3EC6FF22",alignItems:"center",justifyContent:"center",backgroundColor:"#1A1D23"},
  chkOn:{borderColor:"#3EC6FF",backgroundColor:"#3EC6FF22"},
  chkT:{color:"#6A7A8E",fontSize:12,fontWeight:"900"},
  chkTOn:{color:"#3EC6FF",fontWeight:"900"},

  modalWrap:{position:"absolute",left:0,right:0,top:0,bottom:0,backgroundColor:"#0D0F13"},
  modalHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:14,paddingTop:6,paddingBottom:6},
  modalTitle:{color:"#fff",fontSize:20,fontWeight:"900"},
  modalClose:{color:"#9aa",fontSize:20,fontWeight:"900"},

  formLabel:{color:"#9aa",marginTop:8,marginBottom:6,fontWeight:"700"},
  dualRow:{flexDirection:"row",gap:8,marginBottom:6},
  duo:{flex:1},
  dualWrap:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:8,marginBottom:4},
  formChipHalf:{width:"49%",height:50,paddingHorizontal:12,borderWidth:2,borderRadius:12,alignItems:"center"},
  formChipT:{fontWeight:"900",fontSize:14},

  toggle:{flex:1,paddingVertical:12,paddingHorizontal:12,borderRadius:10,backgroundColor:"#161A22",borderWidth:1,borderColor:"#2A2F38",alignItems:"center"},
  toggleOn:{backgroundColor:"#3A3F4A"},
  toggleT:{color:"#9aa",fontWeight:"800"},
  toggleTOn:{color:"#fff"},

  picker:{height:44,paddingHorizontal:12,borderRadius:10,backgroundColor:"#151821",borderWidth:1,borderColor:"#2A2F38",alignItems:"center",justifyContent:"center"},
  pickerT:{color:"#cfd6e4",fontWeight:"800"},

  input:{backgroundColor:"#151821",color:"#fff",padding:12,borderRadius:10,borderWidth:1,borderColor:"#2A2F38",marginBottom:8},

  durationGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",rowGap:8,marginBottom:2},
  timeChipGrid:{width:"23%",alignItems:"center",paddingVertical:10,borderRadius:10,backgroundColor:"#1A1D23",borderWidth:1,borderColor:"#2A2F38"},
  timeChipGridOn:{backgroundColor:"#3A3F4A"},
  timeChipGridT:{color:"#9aa",fontWeight:"800",fontSize:12},
  timeChipGridTOn:{color:"#fff"},

  primaryBtn:{backgroundColor:"#3EC6FF",padding:12,borderRadius:10,flex:1},
  primaryText:{color:"#0D0F13",textAlign:"center",fontWeight:"900"},
  secondaryBtn:{backgroundColor:"#3EC6FF22",borderColor:"#3EC6FF",borderWidth:1,padding:12,borderRadius:10,flex:1},
  secondaryText:{color:"#3EC6FF",textAlign:"center",fontWeight:"800"},

  noteBox:{marginTop:10,backgroundColor:"#151821",borderWidth:1,borderColor:"#2A2F38",borderRadius:12,padding:12,marginHorizontal:12},
  note:{color:"#cbd3df",textAlign:"center"},
});
