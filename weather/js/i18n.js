/*
 * ენები (ქართული / English / Русский) და ერთეულები (°C/°F, მ/წ / კმ/სთ, 24/12 საათი).
 * I18N.t('key', {n: 5}) — ტექსტი; data-i18n="key" ატრიბუტით HTML-იც ითარგმნება.
 */
(function (root) {
  'use strict';

  var D = {
    ka: {
      appName: 'ხუთი ამინდი', appSub: '5 პროგნოზი და მათი საერთო შედეგი',
      refresh: 'განახლება', settings: 'პარამეტრები', themeDark: 'მუქი თემა', themeLight: 'ღია თემა',
      tabHome: 'ამინდი', tabMap: 'რუკა', tabRoad: 'გზა და მთა', tabAccuracy: 'სიზუსტე',
      searchPh: 'ქალაქის ძებნა, მაგ. ბათუმი', search: 'ძებნა', myLocation: 'ჩემი მდებარეობა', searching: 'ვეძებ…',
      notFound: 'ვერაფერი მოიძებნა. სცადე ლათინურად (მაგ. Batumi).', searchFailed: 'ძებნა ვერ მოხერხდა: {e}',
      favHint: 'დააჭირე ☆-ს ქალაქის ფავორიტებში დასამატებლად.', favAdd: 'ფავორიტებში დამატება', favRemove: 'ფავორიტებიდან წაშლა',
      gpsNA: 'მდებარეობის განსაზღვრა მიუწვდომელია', gpsWait: 'ვადგენ მდებარეობას…', gpsDenied: 'მდებარეობაზე წვდომა უარყოფილია', gpsFail: 'მდებარეობა ვერ განისაზღვრა',
      loading: 'იტვირთება…', loadingForecasts: 'პროგნოზები იტვირთება…', noData: 'მონაცემები ვერ მივიღეთ. სცადე განახლება.',
      refreshing: 'ვაახლებ პროგნოზებს…', updating: 'ახლდება…', justNow: 'ახლახან', minAgo: '{n} წთ წინ', hAgo: '{n} სთ წინ',
      errBusy: 'სერვისი გადატვირთულია, სცადე მოგვიანებით', errCode: 'შეცდომა {n}', errSlow: 'პასუხი დიდხანს არ მოვიდა', errNet: 'ქსელის შეცდომა',
      sources: '{n} წყარო', range: 'დიაპაზონი {a}…{b}', today: 'დღეს', tomorrow: 'ხვალ', todayRange: 'დღეს: {a} / {b}',
      feels: 'შეიგრძნობა როგორც {t}', warmerThanYesterday: 'გუშინდელზე {d}-ით თბილა', colderThanYesterday: 'გუშინდელზე {d}-ით ცივა', sameAsYesterday: 'დაახლოებით როგორც გუშინ',
      normalToday: 'ნორმა ამ დღეს: {a} / {b}', share: 'გაზიარება',
      agreement: 'შეთანხმება: {x}', agreeHigh: 'მაღალი', agreeMid: 'საშუალო', agreeLow: 'დაბალი', singleSource: 'ერთი წყარო', consensus: 'საერთო', approxConsensus: '≈', defaultCity: 'თბილისი', defaultCountry: 'საქართველო',
      sourcesNow: 'წყაროები ახლა', next24: 'მომდევნო 24 საათი', tempCompare: 'ტემპერატურის შედარება', chart24: '24 საათი', chart7: '7 დღე (მაქს.)',
      chartTitle24: 'ტემპერატურა 24 საათში, წყაროების მიხედვით', chartTitle7: 'მაქსიმალური ტემპერატურა 7 დღეში', noChartData: 'მონაცემები ჯერ არ არის.',
      days7: '7 დღე', dayHint: 'დააჭირე დღეს, რომ ნახო თითოეული წყაროს პროგნოზი.',
      thSource: 'წყარო', thWeather: 'ამინდი', thMinMax: 'მინ/მაქს', thPrecip: 'ნალექი', thWind: 'ქარი', precipLbl: 'ნალექი {x}', windLbl: 'ქარი {x}',
      howTitle: 'როგორ ითვლება საერთო პროგნოზი',
      how1: '<b>წყაროები</b> — yr.no-ს პროგნოზი და მსოფლიოს ოთხი წამყვანი ამინდის მოდელი: ევროპული (ECMWF), ამერიკული (GFS), გერმანული (ICON) და ბრიტანული (UK Met Office). ყველა უფასოა და გასაღებს არ საჭიროებს.',
      how2: '<b>ტემპერატურა, ქარი, ნალექის რაოდენობა</b> — მედიანა (შუა მნიშვნელობა), ასე ერთი გადახრილი წყარო შედეგს ვერ აფუჭებს. თუ „სიზუსტით შეწონვა“ ჩართულია, ზუსტ წყაროს ტემპერატურაში მეტი წონა აქვს.',
      how3: '<b>ამინდის ტიპი</b> (მზიანი, წვიმა...) — ხმათა უმრავლესობა.',
      how4: '<b>ნალექის ალბათობა</b> — საშუალო არითმეტიკული.',
      how5: '<b>შეთანხმება</b> — მაღალი, როცა ტემპერატურა ≤2°-ით (დღიურში ≤3°) განსხვავდება და ¾+ წყარო ერთ ამინდზე თანხმდება; საშუალო — ≤4° (დღიურში ≤6°) და ნახევარი; სხვა შემთხვევაში დაბალი.',
      wearTitle: 'რა ჩავიცვა', wear_hot: 'მაისური და შორტები — ცხელა', wear_warm: 'მაისური, მსუბუქი შარვალი', wear_mild: 'სვიტერი ან თხელი ქურთუკი',
      wear_cool: 'ქურთუკი', wear_cold: 'თბილი ქურთუკი და ქუდი', wear_freezing: 'ზამთრის ქურთუკი, ქუდი, ხელთათმანი, შარფი',
      wx_umbrella: '☂ ქოლგა აუცილებლად', wx_maybeUmbrella: '☂ ქოლგა ჩანთაში ჩაიდე', wx_boots: '🥾 წყალგაუმტარი ფეხსაცმელი', wx_windproof: '🧥 ქარგაუმტარი ზედა',
      wx_sunscreen: '🧴 მზის კრემი და სათვალე', wx_sunglasses: '🕶 მზის სათვალე', wx_layers: '🧅 ფენებად ჩაიცვი — დღისით და საღამოს დიდი სხვაობაა',
      wearFeels: 'მომდევნო 12 საათში შეიგრძნობა {a}…{b}',
      detailsTitle: 'დღის დეტალები', air: 'ჰაერის ხარისხი', uv: 'UV ინდექსი', uvMax: 'მაქს. დღეს {x}', sun: 'მზე', moon: 'მთვარე',
      sunrise: 'ამოსვლა', sunset: 'ჩასვლა', dayLength: 'დღე {h} სთ {m} წთ', polarDay: 'პოლარული დღე', polarNight: 'პოლარული ღამე',
      illum: 'განათებულია {x}', fullIn: 'სავსემთვარეობა {n} დღეში', fullToday: 'დღეს სავსემთვარეობაა',
      aqi_good: 'კარგი', aqi_fair: 'მისაღები', aqi_moderate: 'საშუალო', aqi_poor: 'ცუდი', aqi_veryPoor: 'ძალიან ცუდი', aqi_extreme: 'საშიში',
      uv_low: 'დაბალი', uv_moderate: 'ზომიერი', uv_high: 'მაღალი', uv_veryHigh: 'ძალიან მაღალი', uv_extreme: 'ექსტრემალური',
      phase_new: 'ახალი მთვარე', phase_waxingCrescent: 'მზარდი ნამგალი', phase_firstQuarter: 'პირველი მეოთხედი', phase_waxingGibbous: 'მზარდი მთვარე',
      phase_full: 'სავსე მთვარე', phase_waningGibbous: 'კლებადი მთვარე', phase_lastQuarter: 'ბოლო მეოთხედი', phase_waningCrescent: 'კლებადი ნამგალი',
      windFrom: '{d} ქარი', gusts: 'ცალკეული ნაკადები {x}-მდე', humidity: 'ტენიანობა', pressure: 'წნევა',
      compass: ['ჩრდილოეთის', 'ჩრდილო-აღმოსავლეთის', 'აღმოსავლეთის', 'სამხრეთ-აღმოსავლეთის', 'სამხრეთის', 'სამხრეთ-დასავლეთის', 'დასავლეთის', 'ჩრდილო-დასავლეთის'],
      compassShort: ['ჩ', 'ჩა', 'ა', 'სა', 'ს', 'სდ', 'დ', 'ჩდ'],
      alertsTitle: 'გაფრთხილება', al_thunder: 'ჭექა-ქუხილი, შესაძლოა სეტყვა', al_wind: 'ძლიერი ქარი, {x}-მდე', al_ice: 'მოყინულობა — გზა და ტროტუარი სრიალა იქნება',
      al_rain: 'ძლიერი წვიმა, {x}', al_heat: 'სიცხე, {x}-მდე', al_frost: 'ყინვა, {x}-მდე', al_fog: 'ნისლი, ხილვადობა {x}', al_snow: 'თოვლი, {x}',
      lvl_yellow: 'ყურადღება', lvl_orange: 'საშიში', lvl_red: 'ძალიან საშიში',
      bestTitle: 'საუკეთესო დღე ამ კვირაში', act_picnic: '🧺 პიკნიკი', act_hike: '🥾 ლაშქრობა', act_laundry: '👕 სარეცხის გაშრობა', act_carwash: '🚗 მანქანის რეცხვა',
      noGoodDay: 'კარგი დღე არ ჩანს', score: '{n}/100',
      mapTitle: 'ნალექის რადარი', radar: 'რადარი', satellite: 'თანამგზავრი', play: 'Play', pause: 'Pause',
      mapNote: 'რადარი აჩვენებს ბოლო ~2 საათის ნალექს. საქართველოს ნაწილზე რადარის დაფარვა სუსტია — ცარიელი რუკა ყოველთვის არ ნიშნავს, რომ წვიმა არ მოდის.',
      mapFail: 'რუკა ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.',
      roadTitle: 'მძღოლისთვის — მომდევნო 12 საათი', road_ok: 'გზაზე განსაკუთრებული საფრთხე არ ჩანს', road_caution: 'იყავი ფრთხილად', road_danger: 'საშიში პირობები',
      rk_ice: 'მოყინულობის საფრთხე (ტემპერატურა {x})', rk_coldRoad: 'ცივი გზა, შესაძლოა სრიალი ხიდებზე და ჩრდილში ({x})', rk_fog: 'ნისლი, ხილვადობა {x}',
      rk_snow: 'თოვლი, {x}', rk_heavyRain: 'ძლიერი წვიმა, {x}', rk_wind: 'ძლიერი ქარი, {x}-მდე',
      passesTitle: 'მთის უღელტეხილები — მომდევნო 24 საათი', pass_ok: 'ნორმალური', pass_caution: 'ფრთხილად', pass_danger: 'საშიში',
      p_jvari: 'ჯვრის უღელტეხილი', p_rikoti: 'რიკოთის უღელტეხილი', p_goderdzi: 'გოდერძის უღელტეხილი', p_abano: 'აბანოს უღელტეხილი',
      r_gudauri: 'გუდაური', r_bakuriani: 'ბაკურიანი', r_tetnuldi: 'თეთნულდი (მესტია)', r_goderdziResort: 'გოდერძი (კურორტი)',
      passSnow: 'თოვლი {x}', passMin: 'მინ. {x}', passVis: 'ხილვადობა {x}', passIcy: 'მოყინულობა', elev: '{x} მ',
      passNote: 'ეს ამინდის პროგნოზია და არა გზის ოფიციალური სტატუსი. გზის დახურვის შესახებ ინფორმაციას აქვეყნებს საავტომობილო გზების დეპარტამენტი.',
      mountainTitle: 'მთის რეჟიმი', snowDepth: 'თოვლის საფარი', newSnow24: 'ახალი თოვლი 24 სთ-ში', newSnow72: 'ახალი თოვლი 72 სთ-ში', fallen24: 'მოვიდა ბოლო 24 სთ-ში',
      freezing: 'ნულოვანი იზოთერმა', elevationLbl: 'ადგილის სიმაღლე', altTemps: 'ტემპერატურა სიმაღლეზე (ახლა)', mountainLow: 'ამ ადგილას თოვლი და მაღალმთიანი პირობები არ ჩანს. ქვემოთ — სათხილამურო კურორტები.',
      resortsTitle: 'სათხილამურო კურორტები — 3 დღე', resortLine: 'საფარი {d} · ახალი თოვლი {n}',
      accTitle: 'რომელი წყაროა ყველაზე ზუსტი აქ', accIntro: 'ბოლო 7 დღის განმავლობაში თითოეული წყაროს „ხვალინდელი“ პროგნოზი შევადარეთ რეალურ ტემპერატურას (ყველა მოდელის ანალიზის მედიანა).',
      accError: 'საშუალო ცდომილება ±{x}', accNone: 'ჯერ არ არის საკმარისი მონაცემი', accYrNote: 'yr.no-ს სიზუსტეს აპი თავად აგროვებს ამ მოწყობილობაზე — რამდენიმე დღე სჭირდება.',
      accWeighting: 'ზუსტ წყაროებს საერთო ტემპერატურაში მეტი წონა აქვს', accEqual: 'ყველა წყაროს თანაბარი წონა აქვს', accFail: 'სიზუსტის მონაცემები ვერ ჩაიტვირთა.',
      accBest: 'ყველაზე ზუსტი', weightLbl: 'წონა ×{x}',
      histTitle: 'ისტორია: ეს დღე წინა წლებში', histNormal: 'ნორმა (1991–2020)', histRecHi: 'სიცხის რეკორდი', histRecLo: 'სიცივის რეკორდი',
      histToday: 'დღევანდელი მაქსიმუმი ნორმაზე {d}-ით {w}', warmer: 'მაღალია', colder: 'დაბალია', histAtNormal: 'დღეს ნორმის ფარგლებშია',
      histYear: '{y} წ.', histSource: 'მონაცემები: ERA5 რეანალიზი (Copernicus), {a}–{b}', histFail: 'ისტორიული მონაცემები ვერ ჩაიტვირთა.',
      setTitle: 'პარამეტრები', setLang: 'ენა', setTemp: 'ტემპერატურა', setWind: 'ქარის სიჩქარე', setTime: 'დრო', setSources: 'წყაროები',
      setWeighting: 'სიზუსტით შეწონვა', setWeightingHint: 'ზუსტ წყაროს ტემპერატურაში მეტი წონა ექნება', setNotify: 'წვიმის და საშიში ამინდის შეტყობინება',
      setNotifyHint: 'Android-ზე და კომპიუტერზე მუშაობს, როცა აპი დაყენებულია. iPhone-ზე — მხოლოდ აპის გახსნისას.',
      notifyDenied: 'შეტყობინებები დაბლოკილია ბრაუზერის პარამეტრებში', notifyOn: 'შეტყობინებები ჩართულია', notifyNA: 'ეს ბრაუზერი შეტყობინებებს არ უჭერს მხარს',
      close: 'დახურვა', save: 'შენახვა', h24: '24 საათი', h12: '12 საათი (AM/PM)', atLeastOne: 'ერთი წყარო მაინც უნდა იყოს ჩართული',
      notifyRainTitle: 'წვიმა იწყება', notifyRainBody: '{place}: ნალექი მოსალოდნელია {time}-დან ({p})', notifyAlertTitle: '{place}: {x}',
      shareText: '{place}: {t}, {c}. ხუთი ამინდი', shareFail: 'გაზიარება ვერ მოხერხდა', shareSaved: 'სურათი შენახულია',
      footer: 'მონაცემები: MET Norway (yr.no); ECMWF, NOAA GFS, DWD ICON და UK Met Office მოდელები — Open-Meteo.com (CC BY 4.0); რადარი — RainViewer; რუკა — © OpenStreetMap, © CARTO.',
      unitMs: 'მ/წ', unitKmh: 'კმ/სთ', unitMm: 'მმ', unitCm: 'სმ', unitM: 'მ', unitKm: 'კმ', unitH: 'სთ',
      weekdays: ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'],
      wdShort: ['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'],
      months: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
      cond: { clear: 'მზიანი', partly: 'ცვალებადი ღრუბელი', cloudy: 'მოღრუბლული', fog: 'ნისლი', lightrain: 'მსუბუქი წვიმა', rain: 'წვიმა',
        heavyrain: 'ძლიერი წვიმა', sleet: 'თოვჭყაპი', snow: 'თოვლი', thunder: 'ჭექა-ქუხილი' },
      srcBy: { yr: 'MET Norway, ნორვეგია', ecmwf: 'ევროპის ცენტრი', gfs: 'NOAA, აშშ', icon: 'DWD, გერმანია', ukmo: 'დიდი ბრიტანეთი' }
    },

    en: {
      appName: 'Five Weather', appSub: '5 forecasts and their consensus',
      refresh: 'Refresh', settings: 'Settings', themeDark: 'Dark theme', themeLight: 'Light theme',
      tabHome: 'Weather', tabMap: 'Map', tabRoad: 'Road & mountains', tabAccuracy: 'Accuracy',
      searchPh: 'Search a city, e.g. Batumi', search: 'Search', myLocation: 'My location', searching: 'Searching…',
      notFound: 'Nothing found. Try another spelling.', searchFailed: 'Search failed: {e}',
      favHint: 'Tap ☆ to add a city to favorites.', favAdd: 'Add to favorites', favRemove: 'Remove from favorites',
      gpsNA: 'Location is not available', gpsWait: 'Finding your location…', gpsDenied: 'Location access was denied', gpsFail: 'Could not find your location',
      loading: 'Loading…', loadingForecasts: 'Loading forecasts…', noData: 'Could not get data. Try refreshing.',
      refreshing: 'Refreshing forecasts…', updating: 'Updating…', justNow: 'just now', minAgo: '{n} min ago', hAgo: '{n} h ago',
      errBusy: 'Service is busy, try again later', errCode: 'Error {n}', errSlow: 'The server took too long', errNet: 'Network error',
      sources: '{n} sources', range: 'range {a}…{b}', today: 'Today', tomorrow: 'Tomorrow', todayRange: 'Today: {a} / {b}',
      feels: 'Feels like {t}', warmerThanYesterday: '{d} warmer than yesterday', colderThanYesterday: '{d} colder than yesterday', sameAsYesterday: 'About the same as yesterday',
      normalToday: 'Normal for today: {a} / {b}', share: 'Share',
      agreement: 'Agreement: {x}', agreeHigh: 'high', agreeMid: 'medium', agreeLow: 'low', singleSource: 'one source', consensus: 'Consensus', approxConsensus: '≈', defaultCity: 'Tbilisi', defaultCountry: 'Georgia',
      sourcesNow: 'Sources now', next24: 'Next 24 hours', tempCompare: 'Temperature comparison', chart24: '24 hours', chart7: '7 days (max)',
      chartTitle24: 'Temperature over 24 hours by source', chartTitle7: 'Maximum temperature over 7 days', noChartData: 'No data yet.',
      days7: '7 days', dayHint: 'Tap a day to see each source\'s forecast.',
      thSource: 'Source', thWeather: 'Weather', thMinMax: 'Min/max', thPrecip: 'Precip.', thWind: 'Wind', precipLbl: 'precipitation {x}', windLbl: 'wind {x}',
      howTitle: 'How the consensus is calculated',
      how1: '<b>Sources</b> — the yr.no forecast plus four leading global weather models: European (ECMWF), American (GFS), German (ICON) and British (UK Met Office). All free, no keys.',
      how2: '<b>Temperature, wind, precipitation amount</b> — the median, so one outlier cannot skew the result. With "accuracy weighting" on, more accurate sources weigh more in the temperature.',
      how3: '<b>Weather type</b> (sunny, rain…) — majority vote.',
      how4: '<b>Chance of precipitation</b> — the arithmetic mean.',
      how5: '<b>Agreement</b> — high when temperatures differ by ≤2° (≤3° daily) and ¾+ of sources agree on the weather; medium at ≤4° (≤6° daily) and half; low otherwise.',
      wearTitle: 'What to wear', wear_hot: 'T-shirt and shorts — it\'s hot', wear_warm: 'T-shirt, light trousers', wear_mild: 'Sweater or a light jacket',
      wear_cool: 'Jacket', wear_cold: 'Warm jacket and a hat', wear_freezing: 'Winter coat, hat, gloves, scarf',
      wx_umbrella: '☂ Take an umbrella', wx_maybeUmbrella: '☂ Keep an umbrella in your bag', wx_boots: '🥾 Waterproof shoes', wx_windproof: '🧥 Windproof layer',
      wx_sunscreen: '🧴 Sunscreen and sunglasses', wx_sunglasses: '🕶 Sunglasses', wx_layers: '🧅 Dress in layers — big day/evening difference',
      wearFeels: 'Feels like {a}…{b} over the next 12 hours',
      detailsTitle: 'Today\'s details', air: 'Air quality', uv: 'UV index', uvMax: 'max today {x}', sun: 'Sun', moon: 'Moon',
      sunrise: 'Sunrise', sunset: 'Sunset', dayLength: 'Day {h} h {m} min', polarDay: 'Polar day', polarNight: 'Polar night',
      illum: '{x} illuminated', fullIn: 'Full moon in {n} days', fullToday: 'Full moon today',
      aqi_good: 'Good', aqi_fair: 'Fair', aqi_moderate: 'Moderate', aqi_poor: 'Poor', aqi_veryPoor: 'Very poor', aqi_extreme: 'Hazardous',
      uv_low: 'Low', uv_moderate: 'Moderate', uv_high: 'High', uv_veryHigh: 'Very high', uv_extreme: 'Extreme',
      phase_new: 'New moon', phase_waxingCrescent: 'Waxing crescent', phase_firstQuarter: 'First quarter', phase_waxingGibbous: 'Waxing gibbous',
      phase_full: 'Full moon', phase_waningGibbous: 'Waning gibbous', phase_lastQuarter: 'Last quarter', phase_waningCrescent: 'Waning crescent',
      windFrom: 'from {d}', gusts: 'gusts up to {x}', humidity: 'Humidity', pressure: 'Pressure',
      compass: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
      compassShort: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
      alertsTitle: 'Warning', al_thunder: 'Thunderstorms, possible hail', al_wind: 'Strong wind, up to {x}', al_ice: 'Icy conditions — slippery roads and sidewalks',
      al_rain: 'Heavy rain, {x}', al_heat: 'Heat, up to {x}', al_frost: 'Frost, down to {x}', al_fog: 'Fog, visibility {x}', al_snow: 'Snow, {x}',
      lvl_yellow: 'Be aware', lvl_orange: 'Be prepared', lvl_red: 'Take action',
      bestTitle: 'Best day this week', act_picnic: '🧺 Picnic', act_hike: '🥾 Hiking', act_laundry: '👕 Drying laundry', act_carwash: '🚗 Car wash',
      noGoodDay: 'No good day ahead', score: '{n}/100',
      mapTitle: 'Precipitation radar', radar: 'Radar', satellite: 'Satellite', play: 'Play', pause: 'Pause',
      mapNote: 'Radar shows precipitation over the last ~2 hours. Radar coverage is weak over parts of Georgia — an empty map does not always mean no rain.',
      mapFail: 'The map could not load. Check your connection.',
      roadTitle: 'For drivers — next 12 hours', road_ok: 'No particular road hazards', road_caution: 'Drive carefully', road_danger: 'Dangerous conditions',
      rk_ice: 'Risk of ice (temperature {x})', rk_coldRoad: 'Cold road, possible slippery bridges and shade ({x})', rk_fog: 'Fog, visibility {x}',
      rk_snow: 'Snow, {x}', rk_heavyRain: 'Heavy rain, {x}', rk_wind: 'Strong wind, up to {x}',
      passesTitle: 'Mountain passes — next 24 hours', pass_ok: 'Normal', pass_caution: 'Caution', pass_danger: 'Dangerous',
      p_jvari: 'Jvari Pass', p_rikoti: 'Rikoti Pass', p_goderdzi: 'Goderdzi Pass', p_abano: 'Abano Pass',
      r_gudauri: 'Gudauri', r_bakuriani: 'Bakuriani', r_tetnuldi: 'Tetnuldi (Mestia)', r_goderdziResort: 'Goderdzi (resort)',
      passSnow: 'snow {x}', passMin: 'min {x}', passVis: 'visibility {x}', passIcy: 'icy', elev: '{x} m',
      passNote: 'This is a weather forecast, not an official road status. Road closures are published by the Roads Department of Georgia.',
      mountainTitle: 'Mountain mode', snowDepth: 'Snow depth', newSnow24: 'New snow in 24 h', newSnow72: 'New snow in 72 h', fallen24: 'Fell in the last 24 h',
      freezing: 'Freezing level', elevationLbl: 'Elevation', altTemps: 'Temperature by altitude (now)', mountainLow: 'No snow or mountain conditions here. Ski resorts are below.',
      resortsTitle: 'Ski resorts — 3 days', resortLine: 'depth {d} · new snow {n}',
      accTitle: 'Which source is most accurate here', accIntro: 'Over the last 7 days, each source\'s "tomorrow" forecast was compared with the actual temperature (median of all models\' analyses).',
      accError: 'average error ±{x}', accNone: 'Not enough data yet', accYrNote: 'The app collects yr.no accuracy on this device itself — it needs a few days.',
      accWeighting: 'More accurate sources weigh more in the consensus temperature', accEqual: 'All sources weigh the same', accFail: 'Accuracy data could not load.',
      accBest: 'Most accurate', weightLbl: 'weight ×{x}',
      histTitle: 'History: this day in past years', histNormal: 'Normal (1991–2020)', histRecHi: 'Record high', histRecLo: 'Record low',
      histToday: 'Today\'s high is {d} {w} normal', warmer: 'above', colder: 'below', histAtNormal: 'Today is within the normal range',
      histYear: '{y}', histSource: 'Data: ERA5 reanalysis (Copernicus), {a}–{b}', histFail: 'Historical data could not load.',
      setTitle: 'Settings', setLang: 'Language', setTemp: 'Temperature', setWind: 'Wind speed', setTime: 'Time', setSources: 'Sources',
      setWeighting: 'Accuracy weighting', setWeightingHint: 'More accurate sources get more weight in the temperature', setNotify: 'Rain and severe weather notifications',
      setNotifyHint: 'Works on Android and desktop when the app is installed. On iPhone, only when the app is opened.',
      notifyDenied: 'Notifications are blocked in browser settings', notifyOn: 'Notifications are on', notifyNA: 'This browser does not support notifications',
      close: 'Close', save: 'Save', h24: '24-hour', h12: '12-hour (AM/PM)', atLeastOne: 'Keep at least one source on',
      notifyRainTitle: 'Rain is starting', notifyRainBody: '{place}: precipitation expected from {time} ({p})', notifyAlertTitle: '{place}: {x}',
      shareText: '{place}: {t}, {c}. Five Weather', shareFail: 'Could not share', shareSaved: 'Image saved',
      footer: 'Data: MET Norway (yr.no); ECMWF, NOAA GFS, DWD ICON and UK Met Office models via Open-Meteo.com (CC BY 4.0); radar by RainViewer; map © OpenStreetMap, © CARTO.',
      unitMs: 'm/s', unitKmh: 'km/h', unitMm: 'mm', unitCm: 'cm', unitM: 'm', unitKm: 'km', unitH: 'h',
      weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      wdShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      cond: { clear: 'Sunny', partly: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog', lightrain: 'Light rain', rain: 'Rain',
        heavyrain: 'Heavy rain', sleet: 'Sleet', snow: 'Snow', thunder: 'Thunderstorm' },
      srcBy: { yr: 'MET Norway', ecmwf: 'European centre', gfs: 'NOAA, USA', icon: 'DWD, Germany', ukmo: 'United Kingdom' }
    },

    ru: {
      appName: 'Пять погод', appSub: '5 прогнозов и их общий итог',
      refresh: 'Обновить', settings: 'Настройки', themeDark: 'Тёмная тема', themeLight: 'Светлая тема',
      tabHome: 'Погода', tabMap: 'Карта', tabRoad: 'Дороги и горы', tabAccuracy: 'Точность',
      searchPh: 'Поиск города, напр. Батуми', search: 'Найти', myLocation: 'Моё местоположение', searching: 'Ищу…',
      notFound: 'Ничего не найдено. Попробуйте другое написание.', searchFailed: 'Поиск не удался: {e}',
      favHint: 'Нажмите ☆, чтобы добавить город в избранное.', favAdd: 'В избранное', favRemove: 'Убрать из избранного',
      gpsNA: 'Определение местоположения недоступно', gpsWait: 'Определяю местоположение…', gpsDenied: 'Доступ к местоположению запрещён', gpsFail: 'Не удалось определить местоположение',
      loading: 'Загрузка…', loadingForecasts: 'Загружаю прогнозы…', noData: 'Не удалось получить данные. Попробуйте обновить.',
      refreshing: 'Обновляю прогнозы…', updating: 'Обновляется…', justNow: 'только что', minAgo: '{n} мин назад', hAgo: '{n} ч назад',
      errBusy: 'Сервис перегружен, попробуйте позже', errCode: 'Ошибка {n}', errSlow: 'Сервер долго не отвечает', errNet: 'Ошибка сети',
      sources: 'источников: {n}', range: 'разброс {a}…{b}', today: 'Сегодня', tomorrow: 'Завтра', todayRange: 'Сегодня: {a} / {b}',
      feels: 'Ощущается как {t}', warmerThanYesterday: 'На {d} теплее, чем вчера', colderThanYesterday: 'На {d} холоднее, чем вчера', sameAsYesterday: 'Примерно как вчера',
      normalToday: 'Норма для этого дня: {a} / {b}', share: 'Поделиться',
      agreement: 'Согласие: {x}', agreeHigh: 'высокое', agreeMid: 'среднее', agreeLow: 'низкое', singleSource: 'один источник', consensus: 'Общий', approxConsensus: '≈', defaultCity: 'Тбилиси', defaultCountry: 'Грузия',
      sourcesNow: 'Источники сейчас', next24: 'Ближайшие 24 часа', tempCompare: 'Сравнение температуры', chart24: '24 часа', chart7: '7 дней (макс.)',
      chartTitle24: 'Температура за 24 часа по источникам', chartTitle7: 'Максимальная температура за 7 дней', noChartData: 'Данных пока нет.',
      days7: '7 дней', dayHint: 'Нажмите на день, чтобы увидеть прогноз каждого источника.',
      thSource: 'Источник', thWeather: 'Погода', thMinMax: 'Мин/макс', thPrecip: 'Осадки', thWind: 'Ветер', precipLbl: 'осадки {x}', windLbl: 'ветер {x}',
      howTitle: 'Как считается общий прогноз',
      how1: '<b>Источники</b> — прогноз yr.no и четыре ведущие мировые модели погоды: европейская (ECMWF), американская (GFS), немецкая (ICON) и британская (UK Met Office). Все бесплатные, без ключей.',
      how2: '<b>Температура, ветер, количество осадков</b> — медиана, поэтому один выброс не портит результат. С «взвешиванием по точности» точные источники весят больше в температуре.',
      how3: '<b>Тип погоды</b> (солнечно, дождь…) — большинство голосов.',
      how4: '<b>Вероятность осадков</b> — среднее арифметическое.',
      how5: '<b>Согласие</b> — высокое, если температуры отличаются ≤2° (≤3° по дням) и ¾+ источников согласны; среднее — ≤4° (≤6°) и половина; иначе низкое.',
      wearTitle: 'Что надеть', wear_hot: 'Футболка и шорты — жарко', wear_warm: 'Футболка, лёгкие брюки', wear_mild: 'Свитер или лёгкая куртка',
      wear_cool: 'Куртка', wear_cold: 'Тёплая куртка и шапка', wear_freezing: 'Зимняя куртка, шапка, перчатки, шарф',
      wx_umbrella: '☂ Возьмите зонт', wx_maybeUmbrella: '☂ Зонт в сумку на всякий случай', wx_boots: '🥾 Непромокаемая обувь', wx_windproof: '🧥 Ветрозащитная одежда',
      wx_sunscreen: '🧴 Солнцезащитный крем и очки', wx_sunglasses: '🕶 Солнечные очки', wx_layers: '🧅 Одевайтесь слоями — большая разница днём и вечером',
      wearFeels: 'В ближайшие 12 часов ощущается {a}…{b}',
      detailsTitle: 'Подробности дня', air: 'Качество воздуха', uv: 'УФ-индекс', uvMax: 'макс. сегодня {x}', sun: 'Солнце', moon: 'Луна',
      sunrise: 'Восход', sunset: 'Закат', dayLength: 'День {h} ч {m} мин', polarDay: 'Полярный день', polarNight: 'Полярная ночь',
      illum: 'освещено {x}', fullIn: 'Полнолуние через {n} дн.', fullToday: 'Сегодня полнолуние',
      aqi_good: 'Хорошее', aqi_fair: 'Приемлемое', aqi_moderate: 'Среднее', aqi_poor: 'Плохое', aqi_veryPoor: 'Очень плохое', aqi_extreme: 'Опасное',
      uv_low: 'Низкий', uv_moderate: 'Умеренный', uv_high: 'Высокий', uv_veryHigh: 'Очень высокий', uv_extreme: 'Экстремальный',
      phase_new: 'Новолуние', phase_waxingCrescent: 'Растущий серп', phase_firstQuarter: 'Первая четверть', phase_waxingGibbous: 'Растущая луна',
      phase_full: 'Полнолуние', phase_waningGibbous: 'Убывающая луна', phase_lastQuarter: 'Последняя четверть', phase_waningCrescent: 'Убывающий серп',
      windFrom: '{d} ветер', gusts: 'порывы до {x}', humidity: 'Влажность', pressure: 'Давление',
      compass: ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'],
      compassShort: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
      alertsTitle: 'Предупреждение', al_thunder: 'Гроза, возможен град', al_wind: 'Сильный ветер, до {x}', al_ice: 'Гололёд — скользкие дороги и тротуары',
      al_rain: 'Сильный дождь, {x}', al_heat: 'Жара, до {x}', al_frost: 'Мороз, до {x}', al_fog: 'Туман, видимость {x}', al_snow: 'Снег, {x}',
      lvl_yellow: 'Внимание', lvl_orange: 'Опасно', lvl_red: 'Очень опасно',
      bestTitle: 'Лучший день на неделе', act_picnic: '🧺 Пикник', act_hike: '🥾 Поход', act_laundry: '👕 Сушка белья', act_carwash: '🚗 Мойка машины',
      noGoodDay: 'Хорошего дня не видно', score: '{n}/100',
      mapTitle: 'Радар осадков', radar: 'Радар', satellite: 'Спутник', play: 'Воспроизвести', pause: 'Пауза',
      mapNote: 'Радар показывает осадки за последние ~2 часа. Над частью Грузии покрытие радаром слабое — пустая карта не всегда значит, что дождя нет.',
      mapFail: 'Карта не загрузилась. Проверьте интернет.',
      roadTitle: 'Для водителей — ближайшие 12 часов', road_ok: 'Особых опасностей на дороге нет', road_caution: 'Будьте осторожны', road_danger: 'Опасные условия',
      rk_ice: 'Риск гололёда (температура {x})', rk_coldRoad: 'Холодная дорога, возможна скользкость на мостах и в тени ({x})', rk_fog: 'Туман, видимость {x}',
      rk_snow: 'Снег, {x}', rk_heavyRain: 'Сильный дождь, {x}', rk_wind: 'Сильный ветер, до {x}',
      passesTitle: 'Горные перевалы — ближайшие 24 часа', pass_ok: 'Нормально', pass_caution: 'Осторожно', pass_danger: 'Опасно',
      p_jvari: 'Крестовый перевал', p_rikoti: 'Рикотский перевал', p_goderdzi: 'Перевал Годердзи', p_abano: 'Перевал Абано',
      r_gudauri: 'Гудаури', r_bakuriani: 'Бакуриани', r_tetnuldi: 'Тетнульди (Местиа)', r_goderdziResort: 'Годердзи (курорт)',
      passSnow: 'снег {x}', passMin: 'мин. {x}', passVis: 'видимость {x}', passIcy: 'гололёд', elev: '{x} м',
      passNote: 'Это прогноз погоды, а не официальный статус дороги. О закрытии дорог сообщает Департамент автомобильных дорог Грузии.',
      mountainTitle: 'Горный режим', snowDepth: 'Снежный покров', newSnow24: 'Новый снег за 24 ч', newSnow72: 'Новый снег за 72 ч', fallen24: 'Выпало за 24 ч',
      freezing: 'Нулевая изотерма', elevationLbl: 'Высота места', altTemps: 'Температура на высоте (сейчас)', mountainLow: 'Здесь нет снега и горных условий. Ниже — горнолыжные курорты.',
      resortsTitle: 'Горнолыжные курорты — 3 дня', resortLine: 'покров {d} · новый снег {n}',
      accTitle: 'Какой источник здесь точнее всего', accIntro: 'За последние 7 дней «завтрашний» прогноз каждого источника сравнили с фактической температурой (медиана анализов всех моделей).',
      accError: 'средняя ошибка ±{x}', accNone: 'Пока недостаточно данных', accYrNote: 'Точность yr.no приложение собирает само на этом устройстве — нужно несколько дней.',
      accWeighting: 'Точные источники весят больше в общей температуре', accEqual: 'Все источники весят одинаково', accFail: 'Данные о точности не загрузились.',
      accBest: 'Самый точный', weightLbl: 'вес ×{x}',
      histTitle: 'История: этот день в прошлые годы', histNormal: 'Норма (1991–2020)', histRecHi: 'Рекорд жары', histRecLo: 'Рекорд холода',
      histToday: 'Сегодняшний максимум на {d} {w} нормы', warmer: 'выше', colder: 'ниже', histAtNormal: 'Сегодня в пределах нормы',
      histYear: '{y} г.', histSource: 'Данные: реанализ ERA5 (Copernicus), {a}–{b}', histFail: 'Исторические данные не загрузились.',
      setTitle: 'Настройки', setLang: 'Язык', setTemp: 'Температура', setWind: 'Скорость ветра', setTime: 'Время', setSources: 'Источники',
      setWeighting: 'Взвешивание по точности', setWeightingHint: 'Точные источники получат больший вес в температуре', setNotify: 'Уведомления о дожде и опасной погоде',
      setNotifyHint: 'Работает на Android и компьютере, если приложение установлено. На iPhone — только при открытии приложения.',
      notifyDenied: 'Уведомления заблокированы в настройках браузера', notifyOn: 'Уведомления включены', notifyNA: 'Этот браузер не поддерживает уведомления',
      close: 'Закрыть', save: 'Сохранить', h24: '24 часа', h12: '12 часов (AM/PM)', atLeastOne: 'Оставьте включённым хотя бы один источник',
      notifyRainTitle: 'Начинается дождь', notifyRainBody: '{place}: осадки ожидаются с {time} ({p})', notifyAlertTitle: '{place}: {x}',
      shareText: '{place}: {t}, {c}. Пять погод', shareFail: 'Не удалось поделиться', shareSaved: 'Изображение сохранено',
      footer: 'Данные: MET Norway (yr.no); модели ECMWF, NOAA GFS, DWD ICON и UK Met Office — Open-Meteo.com (CC BY 4.0); радар — RainViewer; карта © OpenStreetMap, © CARTO.',
      unitMs: 'м/с', unitKmh: 'км/ч', unitMm: 'мм', unitCm: 'см', unitM: 'м', unitKm: 'км', unitH: 'ч',
      weekdays: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
      wdShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      months: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
      cond: { clear: 'Солнечно', partly: 'Переменная облачность', cloudy: 'Пасмурно', fog: 'Туман', lightrain: 'Небольшой дождь', rain: 'Дождь',
        heavyrain: 'Ливень', sleet: 'Мокрый снег', snow: 'Снег', thunder: 'Гроза' },
      srcBy: { yr: 'MET Norway, Норвегия', ecmwf: 'Европейский центр', gfs: 'NOAA, США', icon: 'DWD, Германия', ukmo: 'Великобритания' }
    }
  };

  var LANGS = ['ka', 'en', 'ru'];
  var prefs = { lang: 'ka', temp: 'c', wind: 'ms', time: '24' };

  function setPrefs(p) {
    Object.keys(p || {}).forEach(function (k) { if (p[k] != null) prefs[k] = p[k]; });
    if (LANGS.indexOf(prefs.lang) === -1) prefs.lang = 'ka';
  }

  function dict() { return D[prefs.lang] || D.ka; }

  function t(key, vars) {
    var s = dict()[key];
    if (s == null) s = D.ka[key];
    if (s == null) return key;
    if (typeof s !== 'string') return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }

  /* ---------- ერთეულები ---------- */

  function temp(c) {
    if (c == null || !isFinite(c)) return '—';
    var v = prefs.temp === 'f' ? c * 9 / 5 + 32 : c;
    return Math.round(v) + '°';
  }
  // ტემპერატურის სხვაობა (ფარენჰაიტში 1.8-ჯერ დიდია)
  function tempDelta(dc) {
    if (dc == null || !isFinite(dc)) return '—';
    var v = Math.abs(prefs.temp === 'f' ? dc * 9 / 5 : dc);
    return (Math.round(v * 10) / 10) + '°';
  }
  function wind(ms) {
    if (ms == null || !isFinite(ms)) return '—';
    if (prefs.wind === 'kmh') return Math.round(ms * 3.6) + ' ' + t('unitKmh');
    return (Math.round(ms * 10) / 10) + ' ' + t('unitMs');
  }
  function mm(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v * 10) / 10) + ' ' + t('unitMm'); }
  function cm(v) { return v == null || !isFinite(v) ? '—' : Math.round(v) + ' ' + t('unitCm'); }
  function pct(v) { return v == null || !isFinite(v) ? '—' : Math.round(v) + '%'; }
  function distance(m) {
    if (m == null || !isFinite(m)) return '—';
    return m >= 1000 ? (Math.round(m / 100) / 10) + ' ' + t('unitKm') : Math.round(m) + ' ' + t('unitM');
  }

  var timeFmt = {};
  function time(ms, tz) {
    if (ms == null) return '—';
    var key = tz + prefs.time;
    if (!timeFmt[key]) {
      timeFmt[key] = new Intl.DateTimeFormat(prefs.time === '12' ? 'en-US' : 'en-GB', {
        timeZone: tz, hour: prefs.time === '12' ? 'numeric' : '2-digit', minute: '2-digit', hour12: prefs.time === '12'
      });
    }
    return timeFmt[key].format(new Date(ms));
  }
  // საათის ეტიკეტი ზოლისთვის: „14:00“ ან „2 PM“
  function hour(h) {
    if (prefs.time === '12') return (h % 12 || 12) + (h < 12 ? ' AM' : ' PM');
    return String(h).padStart(2, '0') + ':00';
  }
  function hourShort(h) {
    if (prefs.time === '12') return (h % 12 || 12) + (h < 12 ? 'a' : 'p');
    return String(h).padStart(2, '0');
  }

  function apply(rootEl) {
    Array.prototype.forEach.call((rootEl || document).querySelectorAll('[data-i18n]'), function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call((rootEl || document).querySelectorAll('[data-i18n-ph]'), function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    Array.prototype.forEach.call((rootEl || document).querySelectorAll('[data-i18n-title]'), function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-title')));
    });
    if (typeof document !== 'undefined') document.documentElement.lang = prefs.lang;
  }

  var api = {
    LANGS: LANGS, D: D, prefs: prefs, setPrefs: setPrefs, t: t, apply: apply,
    temp: temp, tempDelta: tempDelta, wind: wind, mm: mm, cm: cm, pct: pct, distance: distance, time: time, hour: hour, hourShort: hourShort
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof window !== 'undefined' ? window : this);
