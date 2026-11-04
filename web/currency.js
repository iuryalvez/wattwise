'use strict';
// Manual rates use USD as the base. Tariffs, calculations and saved amounts stay BRL.
(() => {
  const I = globalThis.WattWiseI18n, t = I.text, el = id => document.getElementById(id);
  const KEY = 'wattwise-display-currency-v2', LEGACY_KEY = 'wattwise-display-currency-v1', supported = ['USD', 'BRL', 'EUR'];
  const MIN_RATE = 0.00000001, MAX_RATE = 1000000;
  const validRate = value => typeof value === 'number' && Number.isFinite(value) && value >= MIN_RATE && value <= MAX_RATE;
  const validDate = value => typeof value === 'string' && value.length <= 80 && Number.isFinite(Date.parse(value));
  let currency = 'USD', rates = {}, persistence = true, recovered = false, errorKey = null, errorCurrency = null, pendingCurrency = null;
  let settingsOpener = null;
  const sourceCurrency = 'BRL';
  let settingsHooks = {};
  const listeners = new Set();
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw !== null) {
      let saved;
      try { saved = JSON.parse(raw); } catch { recovered = true; }
      if (!saved || ![1,2].includes(saved.version) || !supported.includes(saved.currency) || !saved.rates || typeof saved.rates !== 'object' || Array.isArray(saved.rates)) {
        recovered = true;
      } else {
        for (const code of saved.version === 1 ? ['USD','EUR'] : ['BRL','EUR']) {
          const rate = saved.rates[code];
          if (rate && validRate(rate.value) && validDate(rate.updatedAt)) rates[code] = {value:rate.value, updatedAt:rate.updatedAt};
          else if (rate !== undefined) recovered = true;
        }
        if (saved.version === 1) {
          const previous = rates;
          rates = {};
          if (previous.USD) {
            const brl = 1 / previous.USD.value;
            if (validRate(brl)) rates.BRL = {value:brl,updatedAt:previous.USD.updatedAt};
            if (previous.EUR) {
              const eur = previous.EUR.value / previous.USD.value;
              if (validRate(eur)) rates.EUR = {value:eur,updatedAt:[previous.EUR.updatedAt,previous.USD.updatedAt].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)};
            }
          }
          if ((previous.USD && !rates.BRL) || (previous.EUR && !rates.EUR)) recovered = true;
        }
        if (saved.currency === 'USD' || saved.currency === sourceCurrency || rates[saved.currency]) currency = saved.currency;
        else recovered = true;
      }
    }
  } catch { persistence = false; }
  const rateFor = code => code === 'USD' ? 1 : rates[code]?.value ?? null;
  function snapshot(source=sourceCurrency) {
    return {base_currency:'USD', currency, units_per_usd:rateFor(currency),
      rate_source:currency === 'USD' ? 'identity' : 'manual', rate_updated_at:rates[currency]?.updatedAt ?? null,
      source_currency:source, source_units_per_usd:rateFor(source), source_rate_updated_at:rates[source]?.updatedAt ?? null};
  }
  function format(value, locale = I.locale, source = sourceCurrency) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (!supported.includes(source)) return '—';
    const targetRate = rateFor(currency), sourceRate = rateFor(source);
    if (source !== currency && (targetRate === null || sourceRate === null)) return '—';
    const converted = source === currency ? value : value / sourceRate * targetRate;
    if (!Number.isFinite(converted)) return '—';
    return new Intl.NumberFormat(locale, {style:'currency', currency,
      currencyDisplay:'code'}).format(converted);
  }
  function renderStatus() {
    const current = snapshot();
    const missingCurrency = sourceCurrency === currency ? null : current.units_per_usd === null ? currency : rateFor(sourceCurrency) === null ? sourceCurrency : null;
    const missingRate = missingCurrency !== null;
    let message = missingRate ? t('settings.configure_currency',{currency:missingCurrency}) : currency === sourceCurrency && current.units_per_usd === null ? t('settings.currency_applied',{currency}) + ' ' + t('settings.help') : currency === 'USD' ? t('currency.base_status') : t('currency.converted_status', {
      currency, rate:I.number(current.units_per_usd,20), date:I.date(current.rate_updated_at,{dateStyle:'short',timeStyle:'short'})});
    if (recovered) message += ' ' + t('currency.recovered');
    if (!persistence) message += ' ' + t('currency.session');
    if (el('currency-status')) el('currency-status').textContent = message;
    if (el('currency-error')) {
      el('currency-error').hidden = errorKey === null;
      if (errorKey) el('currency-error').textContent = t(errorKey,{min:I.number(MIN_RATE,8),max:I.number(MAX_RATE,0),currency:errorCurrency || pendingCurrency || currency});
    }
    if (el('settings-pending')) {
      el('settings-pending').hidden = !pendingCurrency || (pendingCurrency === currency && !missingRate);
      el('settings-pending').textContent = pendingCurrency ? t('settings.configure_currency',{currency:pendingCurrency}) : '';
    }
    if (el('currency-notice')) {
      el('currency-notice').textContent = missingRate || !persistence || recovered ? message : t('settings.currency_applied',{currency});
      el('currency-notice').classList.toggle('sr-only',persistence && !recovered && !missingRate);
    }
  }
  function reject(key,code=null) { errorKey = key; errorCurrency = code; renderStatus(); return {ok:false,persisted:false}; }
  function commit(code,nextRates) {
    currency = code; rates = nextRates; errorKey = null; errorCurrency = null; recovered = false;
    try { localStorage.setItem(KEY,JSON.stringify({version:2,currency,rates})); persistence = true; }
    catch { persistence = false; }
    if (el('display-currency')) el('display-currency').value = currency;
    renderStatus();
    for (const listener of listeners) listener();
    return {ok:true,persisted:persistence};
  }
  function rateEntry(code,value) {
    return rates[code]?.value === value ? rates[code] : {value,updatedAt:new Date().toISOString()};
  }
  function apply(code,value) {
    if (!supported.includes(code)) return reject('currency.invalid_currency');
    if (code !== 'USD' && !(code === sourceCurrency && value === undefined) && !validRate(value)) return reject('currency.invalid_rate');
    return commit(code,code === 'USD' || value === undefined ? rates : {...rates,[code]:rateEntry(code,value)});
  }
  function configure(values,code=currency) {
    if (!supported.includes(code)) return reject('currency.invalid_currency');
    const nextRates = {};
    for (const target of ['BRL','EUR']) {
      const value = values?.[target];
      if (value === null || value === undefined) {
        if ((code !== sourceCurrency && target === sourceCurrency) || (code === 'EUR' && target === 'EUR')) return reject('settings.required_rate',target);
      } else if (!validRate(value)) return reject('currency.invalid_rate');
      else nextRates[target] = rateEntry(target,value);
    }
    return commit(code,nextRates);
  }
  function openSettings(requested=null) {
    pendingCurrency = requested; errorKey = null; errorCurrency = null;
    settingsOpener = el(requested ? 'display-currency' : 'open-settings');
    for (const code of ['BRL','EUR']) {
      const input = el(`exchange-${code.toLowerCase()}`);
      input.value = rates[code] ? String(rates[code].value) : '';
      const target = pendingCurrency || currency;
      input.required = (target !== sourceCurrency && code === sourceCurrency) || (target === 'EUR' && code === 'EUR');
      input.setCustomValidity?.('');
    }
    settingsHooks.open?.(); renderStatus(); el('settings-dialog').showModal();
    if (requested) el(`exchange-${requested.toLowerCase()}`).focus();
  }
  globalThis.WattWiseCurrency = {format,snapshot,apply,configure,supported,get currency() {return currency;},
    onSettings:hooks => {settingsHooks = hooks;},
    onChange:listener => listeners.add(listener)};
  if (el('display-currency')) {
    el('display-currency').value = currency;
    el('display-currency').onchange = () => {
      const code = el('display-currency').value;
      if (!supported.includes(code)) {
        el('display-currency').value = currency; reject('currency.invalid_currency'); return;
      }
      if (code === 'USD' || code === sourceCurrency || rates[code]) apply(code,rates[code]?.value);
      else { el('display-currency').value = currency; openSettings(code); }
    };
  }
  if (el('settings-dialog')) {
    el('open-settings').onclick = () => openSettings();
    for (const id of ['close-settings','cancel-settings']) el(id).onclick = () => el('settings-dialog').close();
    el('settings-dialog').addEventListener('close',() => {
      pendingCurrency = null; errorKey = null; errorCurrency = null; settingsHooks.close?.(); renderStatus();
      settingsOpener?.focus(); settingsOpener = null;
    });
    el('settings-form').onsubmit = event => {
      event.preventDefault();
      if (settingsHooks.validate?.() === false) return;
      const values = Object.fromEntries(['BRL','EUR'].map(code => {
        const value = el(`exchange-${code.toLowerCase()}`).value.trim();
        return [code,value === '' ? null : Number(value)];
      }));
      if (configure(values,pendingCurrency || currency).ok) {settingsHooks.save?.(); el('settings-dialog').close();}
    };
  }
  I.onChange(renderStatus); renderStatus();
})();
