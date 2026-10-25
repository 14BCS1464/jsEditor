// Device simulator: phone chrome, React Native primitives, and preview runtime.
let currentDevice = 'iphone';
let currentOrientation = 'portrait';
const WALLPAPERS = [
  { id: 'aurora', name: 'Aurora', dark: true, top: '#0f172a', bottom: '#020617' },
  { id: 'ocean', name: 'Ocean', dark: true, top: '#083344', bottom: '#042f2e' },
  { id: 'sunset', name: 'Sunset', dark: false, top: '#fb923c', bottom: '#4c1d95' },
  { id: 'forest', name: 'Forest', dark: true, top: '#14532d', bottom: '#052e16' },
  { id: 'sand', name: 'Sand', dark: false, top: '#fef3c7', bottom: '#fb7185' },
  { id: 'bloom', name: 'Bloom', dark: false, top: '#fce7f3', bottom: '#c4b5fd' },
  { id: 'midnight', name: 'Midnight', dark: true, top: '#18181b', bottom: '#09090b' },
  { id: 'sky', name: 'Sky', dark: false, top: '#e0f2fe', bottom: '#e2e8f0' }
];
let wallpaperId = 'aurora';
let customWallpaper = null;
try { wallpaperId = localStorage.getItem('rn-wallpaper') || 'aurora'; } catch (e) {}
try {
  const url = localStorage.getItem('rn-wallpaper-image');
  const meta = JSON.parse(localStorage.getItem('rn-wallpaper-meta') || 'null');
  if (url && meta && meta.top && meta.bottom) {
    customWallpaper = { id: 'custom', url: url, dark: !!meta.dark, top: meta.top, bottom: meta.bottom };
  }
} catch (e) {}
if (wallpaperId === 'custom' && !customWallpaper) wallpaperId = 'aurora';

let isDarkPreview = true;
try { isDarkPreview = localStorage.getItem('rn-device') !== 'light'; } catch (e) {}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ==========================================
// 1. REACT NATIVE WEB PRIMITIVES SYSTEM
// ==========================================
const createRNPrimitives = () => {
  const React = window.React;

  const hexToRgba = (color, opacity) => {
    if (typeof color !== 'string' || color[0] !== '#') return color;
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex.slice(0, 6), 16);
    if (isNaN(n)) return color;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
  };

  // Convert RN style objects into valid web CSS
  const processStyles = (styleObj) => {
    if (!styleObj) return {};
    if (Array.isArray(styleObj)) {
      return styleObj.reduce((acc, curr) => ({ ...acc, ...processStyles(curr) }), {});
    }
    if (typeof styleObj !== 'object') return {};

    const css = { ...styleObj };
    const has = (k) => css[k] !== undefined && css[k] !== null;

    const expand = (key, targets) => {
      if (!has(key)) return;
      targets.forEach((t) => { if (!has(t)) css[t] = css[key]; });
      delete css[key];
    };
    expand('marginVertical', ['marginTop', 'marginBottom']);
    expand('marginHorizontal', ['marginLeft', 'marginRight']);
    expand('paddingVertical', ['paddingTop', 'paddingBottom']);
    expand('paddingHorizontal', ['paddingLeft', 'paddingRight']);

    // FIX: unitless lineHeight means "multiplier" on web but "pixels" in RN
    if (typeof css.lineHeight === 'number') css.lineHeight = `${css.lineHeight}px`;

    // FIX: textDecorationLine is not a CSS property on web
    if (has('textDecorationLine')) {
      if (!has('textDecoration')) css.textDecoration = css.textDecorationLine;
      delete css.textDecorationLine;
    }

    // FIX: RN shadow props -> CSS box-shadow
    if (has('shadowColor') || has('shadowRadius') || has('shadowOffset') || has('shadowOpacity')) {
      if (!has('boxShadow')) {
        const o = css.shadowOffset || { width: 0, height: 0 };
        const op = has('shadowOpacity') ? css.shadowOpacity : 1;
        css.boxShadow = `${o.width || 0}px ${o.height || 0}px ${css.shadowRadius || 0}px ${hexToRgba(css.shadowColor || '#000000', op)}`;
      }
    }
    ['shadowColor', 'shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation'].forEach((k) => delete css[k]);

    // RN transform arrays -> CSS transform string
    if (Array.isArray(css.transform)) {
      css.transform = css.transform.map((t) =>
        Object.entries(t).map(([k, v]) => {
          const needsPx = typeof v === 'number' && !/scale|rotate|skew/.test(k);
          return `${k}(${needsPx ? v + 'px' : v})`;
        }).join(' ')
      ).join(' ');
    }

    return css;
  };

  // Only pass props that make sense on a DOM node (avoids "unknown prop" warnings)
  const DOM_PROPS = new Set(['id', 'className', 'role', 'title', 'tabIndex', 'onClick', 'onScroll', 'onMouseEnter', 'onMouseLeave', 'onFocus', 'onBlur', 'onKeyDown', 'onKeyUp', 'onMouseDown', 'onMouseMove', 'onMouseUp', 'onTouchStart', 'onTouchMove', 'onTouchEnd']);

  const useLayoutRef = (ref, onLayout) => {
    const local = React.useRef(null);
    React.useLayoutEffect(() => {
      const node = local.current;
      if (!node || !onLayout) return undefined;
      const fire = () => onLayout({
        nativeEvent: { layout: { x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight } }
      });
      fire();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const ro = new ResizeObserver(fire);
      ro.observe(node);
      return () => ro.disconnect();
    }, [onLayout]);
    return (node) => {
      local.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };
  };
  const domProps = (props) => {
    const out = {};
    Object.keys(props).forEach((k) => {
      if (DOM_PROPS.has(k) || k.startsWith('data-') || k.startsWith('aria-')) out[k] = props[k];
    });
    if (props.testID) out['data-testid'] = props.testID;
    return out;
  };

  const View = React.forwardRef(({ style, children, pointerEvents, onLayout, ...props }, ref) => {
    const setRef = useLayoutRef(ref, onLayout);
    const baseStyle = {
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative',
      borderWidth: 0,
      borderStyle: 'solid',
      borderColor: 'transparent',
      minWidth: 0,
      minHeight: 0
    };
    const extra = pointerEvents ? { pointerEvents: pointerEvents === 'box-none' ? 'none' : pointerEvents } : {};
    return React.createElement('div', {
      ref: setRef,
      style: { ...baseStyle, ...extra, ...processStyles(style) },
      ...domProps(props)
    }, children);
  });

  const Text = React.forwardRef(({ style, children, numberOfLines, onPress, ...props }, ref) => {
    const baseStyle = {
      display: 'inline',
      boxSizing: 'border-box',
      color: 'inherit',
      fontFamily: 'Inter, system-ui, sans-serif'
    };

    let truncateStyle = {};
    if (numberOfLines) {
      truncateStyle = {
        display: '-webkit-box',
        WebkitLineClamp: numberOfLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      };
    }

    const dom = domProps(props);
    if (onPress) { dom.onClick = onPress; truncateStyle.cursor = 'pointer'; }

    return React.createElement('span', {
      ref,
      style: { ...baseStyle, ...processStyles(style), ...truncateStyle },
      ...dom
    }, children);
  });

  const TouchableOpacity = React.forwardRef(({ style, children, onPress, activeOpacity = 0.7, disabled, ...props }, ref) => {
    const [isPressed, setIsPressed] = React.useState(false);
    return React.createElement('div', {
      ref,
      onClick: disabled ? undefined : onPress,
      onMouseDown: () => setIsPressed(true),
      onMouseUp: () => setIsPressed(false),
      onMouseLeave: () => setIsPressed(false),
      onTouchStart: () => setIsPressed(true),
      onTouchEnd: () => setIsPressed(false),
      style: {
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'opacity 0.15s ease',
        opacity: isPressed && !disabled ? activeOpacity : (disabled ? 0.5 : 1),
        borderWidth: 0,
        borderStyle: 'solid',
        borderColor: 'transparent',
        ...processStyles(style)
      },
      ...domProps(props)
    }, children);
  });

  const Pressable = React.forwardRef(({ style, children, onPress, onPressIn, onPressOut, onLongPress, delayLongPress = 500, disabled, ...props }, ref) => {
    const [pressed, setPressed] = React.useState(false);
    const timer = React.useRef(null);
    const longFired = React.useRef(false);
    const held = React.useRef(false);
    const down = (e) => {
      if (disabled) return;
      held.current = true;
      setPressed(true);
      longFired.current = false;
      if (onPressIn) onPressIn(e);
      if (onLongPress) timer.current = setTimeout(() => { longFired.current = true; onLongPress(e); }, delayLongPress);
    };
    const up = (e) => {
      clearTimeout(timer.current);
      if (!held.current) return;
      held.current = false;
      setPressed(false);
      if (onPressOut) onPressOut(e);
    };
    const computedStyle = typeof style === 'function' ? style({ pressed }) : style;
    return React.createElement('div', {
      ref,
      onClick: (e) => { if (!disabled && !longFired.current && onPress) onPress(e); },
      onMouseDown: down,
      onMouseUp: up,
      onMouseLeave: up,
      onTouchStart: down,
      onTouchEnd: up,
      style: {
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        borderWidth: 0,
        borderStyle: 'solid',
        borderColor: 'transparent',
        ...processStyles(computedStyle)
      },
      ...domProps(props)
    }, typeof children === 'function' ? children({ pressed }) : children);
  });

  const ScrollView = React.forwardRef(({ style, contentContainerStyle, children, horizontal, onScroll, onLayout, refreshControl, scrollEnabled = true, pagingEnabled, showsVerticalScrollIndicator = true, showsHorizontalScrollIndicator = true, ...props }, ref) => {
    const outer = React.useRef(null);
    const pullY = React.useRef(0);
    React.useLayoutEffect(() => {
      const node = outer.current;
      if (!node || !onLayout) return undefined;
      const fire = () => onLayout({ nativeEvent: { layout: { x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight } } });
      fire();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const ro = new ResizeObserver(fire);
      ro.observe(node);
      return () => ro.disconnect();
    }, [onLayout]);
    React.useImperativeHandle(ref, () => ({
      scrollTo({ x = 0, y = 0, animated = true } = {}) {
        if (outer.current) outer.current.scrollTo({ left: x, top: y, behavior: animated ? 'smooth' : 'auto' });
      },
      scrollToEnd({ animated = true } = {}) {
        const node = outer.current;
        if (!node) return;
        node.scrollTo({ top: horizontal ? 0 : node.scrollHeight, left: horizontal ? node.scrollWidth : 0, behavior: animated ? 'smooth' : 'auto' });
      },
      getScrollResponder() { return outer.current; }
    }), [horizontal]);
    const rc = refreshControl && refreshControl.props;
    const emitScroll = (e) => {
      const node = e.currentTarget;
      const nativeEvent = {
        contentOffset: { x: node.scrollLeft, y: node.scrollTop },
        contentSize: { width: node.scrollWidth, height: node.scrollHeight },
        layoutMeasurement: { width: node.clientWidth, height: node.clientHeight }
      };
      if (onScroll) onScroll({ nativeEvent });
    };
    const endPull = (e) => {
      const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      if (rc && rc.onRefresh && outer.current && outer.current.scrollTop <= 0 && y - pullY.current > 48) rc.onRefresh();
    };
    const hideBar = (horizontal ? showsHorizontalScrollIndicator : showsVerticalScrollIndicator) ? 'auto' : 'none';
    return React.createElement('div', {
      ref: outer,
      onScroll: emitScroll,
      onMouseDown: (e) => { pullY.current = e.clientY; },
      onMouseUp: endPull,
      onTouchStart: (e) => { pullY.current = e.touches[0].clientY; },
      onTouchEnd: endPull,
      style: {
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        overflowX: !scrollEnabled ? 'hidden' : horizontal ? 'auto' : 'hidden',
        overflowY: !scrollEnabled ? 'hidden' : horizontal ? 'hidden' : 'auto',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box',
        scrollbarWidth: hideBar,
        scrollSnapType: pagingEnabled ? (horizontal ? 'x mandatory' : 'y mandatory') : undefined,
        ...processStyles(style)
      },
      ...domProps(props)
    }, rc && rc.refreshing ? React.createElement('div', { style: { textAlign: 'center', padding: 8, fontSize: 12, opacity: 0.7 } }, 'Refreshing…') : null, React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        minWidth: horizontal ? 'max-content' : '100%',
        boxSizing: 'border-box',
        ...processStyles(contentContainerStyle)
      }
    }, children));
  });

  const renderMaybe = (c) => (c ? (React.isValidElement(c) ? c : React.createElement(c)) : null);

  const FlatList = ({ data = [], renderItem, keyExtractor, style, contentContainerStyle, horizontal, numColumns = 1, columnWrapperStyle, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ItemSeparatorComponent, onEndReached, onEndReachedThreshold = 0.5, refreshing, onRefresh, refreshControl, onScroll, ...props }) => {
    const reached = React.useRef(false);
    const children = [];
    const keyFor = (item, index) => keyExtractor ? keyExtractor(item, index) : (item && item.id != null ? String(item.id) : String(index));
    if (ListHeaderComponent) children.push(React.createElement(React.Fragment, { key: '__header' }, renderMaybe(ListHeaderComponent)));
    if (!data.length && ListEmptyComponent) children.push(React.createElement(React.Fragment, { key: '__empty' }, renderMaybe(ListEmptyComponent)));
    const cols = !horizontal && numColumns > 1 ? numColumns : 1;
    for (let index = 0; index < data.length; index += cols) {
      const cells = [];
      for (let c = 0; c < cols && index + c < data.length; c++) {
        const i = index + c;
        const item = data[i];
        cells.push(React.createElement(React.Fragment, { key: keyFor(item, i) }, renderItem({ item, index: i, separators: {} })));
      }
      if (cols === 1) {
        children.push(cells[0]);
        if (ItemSeparatorComponent && index < data.length - 1) children.push(React.createElement(React.Fragment, { key: 'sep' + index }, renderMaybe(ItemSeparatorComponent)));
      } else {
        children.push(React.createElement(View, { key: 'row' + index, style: [{ flexDirection: 'row' }, columnWrapperStyle] }, cells));
      }
    }
    if (ListFooterComponent) children.push(React.createElement(React.Fragment, { key: '__footer' }, renderMaybe(ListFooterComponent)));
    const rc = refreshControl || (onRefresh ? { props: { refreshing, onRefresh } } : null);
    const handleScroll = (e) => {
      if (onScroll) onScroll(e);
      if (!onEndReached) return;
      const ne = e.nativeEvent;
      const dist = ne.contentSize.height - ne.contentOffset.y - ne.layoutMeasurement.height;
      const limit = onEndReachedThreshold * ne.layoutMeasurement.height;
      if (dist <= limit) {
        if (!reached.current) { reached.current = true; onEndReached({ distanceFromEnd: dist }); }
      } else reached.current = false;
    };
    return React.createElement(ScrollView, { style, contentContainerStyle, horizontal, refreshControl: rc, onScroll: handleScroll, ...props }, children);
  };

  const TextInput = React.forwardRef(({ style, value, defaultValue, onChangeText, onChange, onSubmitEditing, onFocus, onBlur, onEndEditing, placeholder, placeholderTextColor, secureTextEntry, multiline, keyboardType = 'default', returnKeyType, autoCapitalize = 'sentences', editable = true, autoFocus, maxLength, ...props }, ref) => {
    const isMultiline = !!multiline;
    const inputModeMap = { 'numeric': 'numeric', 'number-pad': 'numeric', 'decimal-pad': 'decimal', 'email-address': 'email', 'phone-pad': 'tel' };
    const common = {
      ref,
      className: 'rn-input',
      placeholder,
      readOnly: !editable,
      autoFocus,
      maxLength,
      autoComplete: 'off',
      spellCheck: false,
      autoCapitalize: autoCapitalize === 'none' ? 'off' : autoCapitalize,
      inputMode: inputModeMap[keyboardType],
      onChange: (e) => {
        if (onChangeText) onChangeText(e.target.value);
        if (onChange) onChange({ nativeEvent: { text: e.target.value }, target: e.target });
      },
      onFocus: (e) => onFocus && onFocus({ nativeEvent: { text: e.target.value } }),
      onBlur: (e) => {
        if (onEndEditing) onEndEditing({ nativeEvent: { text: e.target.value } });
        if (onBlur) onBlur({ nativeEvent: { text: e.target.value } });
      },
      style: {
        outline: 'none',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#cbd5e1',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '14px',
        fontFamily: 'inherit',
        color: 'inherit',
        boxSizing: 'border-box',
        backgroundColor: 'transparent',
        '--rn-placeholder': placeholderTextColor || '#94a3b8',
        ...(isMultiline ? { resize: 'none', minHeight: '64px' } : {}),
        ...processStyles(style)
      },
      ...domProps(props)
    };
    // FIX: only control the input when a value is actually provided
    common['data-kb'] = keyboardType || 'default';
    common['data-return-key'] = returnKeyType || '';
    common['data-cap'] = autoCapitalize || 'sentences';
    if (value !== undefined) common.value = value;
    else if (defaultValue !== undefined) common.defaultValue = defaultValue;

    if (isMultiline) return React.createElement('textarea', common);
    common.type = secureTextEntry ? 'password' : 'text';
    common.onKeyDown = (e) => { if (e.key === 'Enter' && onSubmitEditing) onSubmitEditing(e); };
    return React.createElement('input', common);
  });

  const Image = React.forwardRef(({ source, style, resizeMode = 'cover', onLoad, onError, ...props }, ref) => {
    const uri = source && typeof source === 'object' && source.uri ? source.uri : (typeof source === 'string' ? source : '');
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => { setFailed(false); }, [uri]);
    const fit = resizeMode === 'stretch' ? 'fill' : (resizeMode === 'repeat' ? 'none' : resizeMode);
    const box = {
      display: 'block',
      maxWidth: '100%',
      objectFit: fit,
      backgroundColor: '#e2e8f0',
      ...processStyles(style)
    };
    if (!uri || failed) {
      return React.createElement('div', {
        ref,
        style: { ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12, minHeight: 80 }
      }, failed ? 'Could not load image' : 'Add source={{ uri }}');
    }
    return React.createElement('img', {
      ref,
      alt: '',
      src: uri,
      style: box,
      onLoad: (e) => onLoad && onLoad({ nativeEvent: { source: { width: e.target.naturalWidth, height: e.target.naturalHeight, uri } } }),
      onError: () => {
        setFailed(true);
        if (onError) onError({ nativeEvent: { error: 'Image failed to load' } });
      },
      ...domProps(props)
    });
  });

  const Switch = ({ value, onValueChange, disabled, trackColor = { false: '#767577', true: '#81b0ff' }, thumbColor = '#f4f3f4' }) => {
    return React.createElement('div', {
      onClick: () => !disabled && onValueChange && onValueChange(!value),
      style: {
        width: '42px',
        height: '24px',
        backgroundColor: value ? (trackColor.true || '#3b82f6') : (trackColor.false || '#e2e8f0'),
        borderRadius: '12px',
        padding: '2px',
        boxSizing: 'border-box',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s',
        display: 'flex',
        alignItems: 'center'
      }
    }, React.createElement('div', {
      style: {
        width: '20px',
        height: '20px',
        backgroundColor: thumbColor,
        borderRadius: '50%',
        transform: value ? 'translateX(18px)' : 'translateX(0px)',
        transition: 'transform 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
      }
    }));
  };

  const ActivityIndicator = ({ size = 'small', color = '#0000ff', animating = true, style }) => {
    if (!animating) return null;
    const dimension = size === 'large' ? 36 : (typeof size === 'number' ? size : 20);
    return React.createElement('div', {
      style: {
        display: 'inline-block',
        width: dimension + 'px',
        height: dimension + 'px',
        boxSizing: 'border-box',
        border: '3px solid rgba(128,128,128,0.25)',
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'rn-spin 1s linear infinite',
        ...processStyles(style)
      }
    });
  };

  if (!document.getElementById('rn-spinner-style')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'rn-spinner-style';
    styleSheet.innerText = '@keyframes rn-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(styleSheet);
  }

  const SafeAreaView = View;
  const KeyboardAvoidingView = View;

  // FIX: StatusBar was a plain object, so <StatusBar /> crashed. Now a component with static helpers.
  const StatusBar = (p) => { React.useEffect(() => { window.setStatusBar && window.setStatusBar(p); }); return null; };
  StatusBar.setBarStyle = (s) => window.setStatusBar && window.setStatusBar({ barStyle: s });
  StatusBar.setBackgroundColor = (c) => window.setStatusBar && window.setStatusBar({ backgroundColor: c });
  StatusBar.setHidden = () => {};

  const StyleSheet = {
    create: (styles) => styles,
    flatten: (styles) => processStyles(styles),
    compose: (a, b) => [a, b].filter(Boolean),
    hairlineWidth: 1,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
  };

  // FIX: Dimensions now reflect the real emulator screen size
  const getScreenSize = () => {
    const el = document.getElementById('emulator-screen');
    return {
      width: (el && el.clientWidth) || 320,
      height: (el && el.clientHeight) || 560,
      scale: 2,
      fontScale: 1
    };
  };
  const dimListeners = new Set();
  const Dimensions = {
    get: () => getScreenSize(),
    addEventListener: (type, cb) => {
      const fn = () => { const size = getScreenSize(); cb({ window: size, screen: size }); };
      dimListeners.add(fn);
      return { remove: () => dimListeners.delete(fn) };
    },
    set: () => {}
  };
  window.__emitDimensions = () => dimListeners.forEach((fn) => fn());
  const useWindowDimensions = () => {
    const [size, setSize] = React.useState(getScreenSize);
    React.useEffect(() => {
      const sub = Dimensions.addEventListener('change', ({ window: next }) => setSize(next));
      return () => sub.remove();
    }, []);
    return size;
  };

  // FIX: Platform.OS follows the selected device (ios / android)
  const Platform = {
    get OS() {
      if (currentDevice === 'web') return 'web';
      return (currentDevice === 'iphone' || currentDevice === 'ipad') ? 'ios' : 'android';
    },
    get isPad() { return currentDevice === 'ipad'; },
    isTV: false,
    isTesting: false,
    get Version() { return this.OS === 'ios' ? '18.0' : this.OS === 'web' ? 'web' : 35; },
    get constants() {
      if (this.OS === 'web') return { reactNativeVersion: { major: 0, minor: 19 }, Model: 'browser' };
      return this.OS === 'ios'
        ? { forceTouchAvailable: false, interfaceIdiom: this.isPad ? 'pad' : 'phone', osVersion: '18.0', systemName: 'iOS' }
        : { Version: 35, Release: '15', Model: 'sdk', uiMode: 'normal', Brand: 'google' };
    },
    select(obj) {
      const os = this.OS;
      return obj[os] !== undefined ? obj[os] : (obj.native !== undefined ? obj.native : obj.default);
    }
  };

  const Alert = { alert: (title, message, buttons) => window.showNativeAlert(title, message, buttons) };

  const Keyboard = { dismiss: () => {} };

  return {
    View, Text, TouchableOpacity, Pressable, ScrollView, FlatList, TextInput, Image,
    Switch, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, StatusBar, StyleSheet,
    Dimensions, useWindowDimensions, Platform, Alert, Keyboard,
    __internals: { processStyles, domProps }
  };
};


// ==========================================
// 1b. EXTRA RN APIs: Animated, Modal, SectionList, Keyboard, Appearance, modules...
// ==========================================
function createRNExtras(RN) {
  const R = window.React, h = R.createElement;
  const rm = (c) => (c ? (R.isValidElement(c) ? c : h(c)) : null);

  // ----- Easing -----
  const bez = (x1, y1, x2, y2) => (t) => {
    if (t <= 0 || t >= 1) return t;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 20; i++) {
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
      if (x < t) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
  const Easing = {
    linear: (t) => t, ease: bez(0.42, 0, 1, 1), quad: (t) => t * t, cubic: (t) => t * t * t,
    sin: (t) => 1 - Math.cos(t * Math.PI / 2), circle: (t) => 1 - Math.sqrt(1 - t * t),
    exp: (t) => Math.pow(2, 10 * (t - 1)), bezier: bez,
    elastic: (t) => Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1,
    back: (t) => t * t * (2.70158 * t - 1.70158),
    poly: (n) => (t) => Math.pow(t, n),
    bounce: (t) => t < 1 / 2.75 ? 7.5625 * t * t : t < 2 / 2.75 ? (t -= 1.5 / 2.75, 7.5625 * t * t + 0.75) : t < 2.5 / 2.75 ? (t -= 2.25 / 2.75, 7.5625 * t * t + 0.9375) : (t -= 2.625 / 2.75, 7.5625 * t * t + 0.984375),
    in: (f) => f, out: (f) => (t) => 1 - f(1 - t), inOut: (f) => (t) => t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2
  };

  // ----- Animated values -----
  const isNode = (v) => v && typeof v === 'object' && typeof v.__get === 'function';
  const val = (n) => (isNode(n) ? n.__get() : n);
  const mix = (a, b, t) => {
    if (typeof a === 'number') return a + (b - a) * t;
    const re = /-?\d*\.?\d+/g, na = a.match(re) || [], nb = b.match(re) || [];
    let i = 0;
    return a.replace(re, () => { const r = +na[i] + (+nb[i] - +na[i]) * t; i++; return r; });
  };
  class Interp {
    constructor(p, c) { this.p = p; this.c = c; }
    __get() {
      const x = val(this.p), { inputRange: I, outputRange: O, easing = (t) => t } = this.c;
      const ext = (side) => this.c['extrapolate' + side] || this.c.extrapolate || 'extend';
      let k = 1;
      while (k < I.length - 1 && x > I[k]) k++;
      let t = (x - I[k - 1]) / (I[k] - I[k - 1]);
      if (t < 0 && ext('Left') === 'clamp') t = 0;
      if (t > 1 && ext('Right') === 'clamp') t = 1;
      return mix(O[k - 1], O[k], easing(t));
    }
    __subscribe(f) { return this.p.__subscribe(f); }
    interpolate(c) { return new Interp(this, c); }
  }
  class Value {
    constructor(v) { this._v = v; this._ls = new Set(); }
    __get() { return this._v; }
    setValue(v) { this._v = v; this._ls.forEach((f) => f()); }
    __subscribe(f) { this._ls.add(f); return () => this._ls.delete(f); }
    addListener(f) { const w = () => f({ value: this._v }); this._ls.add(w); return w; }
    removeListener(w) { this._ls.delete(w); }
    removeAllListeners() { this._ls.clear(); }
    interpolate(c) { return new Interp(this, c); }
    stopAnimation(cb) { this._stop && this._stop(); cb && cb(this._v); }
    setOffset() {} flattenOffset() {}
    resetAnimation(cb) { this.setValue(0); cb && cb(this._v); }
  }
  class ValueXY {
    constructor(v = {}) { this.x = new Value(v.x || 0); this.y = new Value(v.y || 0); }
    setValue(v) { this.x.setValue(v.x || 0); this.y.setValue(v.y || 0); }
    setOffset() {} flattenOffset() {}
    stopAnimation(cb) { this.x.stopAnimation(); this.y.stopAnimation(); cb && cb({ x: this.x.__get(), y: this.y.__get() }); }
    getLayout() { return { left: this.x, top: this.y }; }
    getTranslateTransform() { return [{ translateX: this.x }, { translateY: this.y }]; }
    __get() { return { x: this.x.__get(), y: this.y.__get() }; }
  }
  const isXY = (value) => value && value.x && value.y && typeof value.x.setValue === 'function' && !(value instanceof Value);
  class Op {
    constructor(a, b, f) { this.a = a; this.b = b; this.f = f; }
    __get() { return this.f(val(this.a), val(this.b)); }
    __subscribe(fn) { const u = [this.a, this.b].filter(isNode).map((n) => n.__subscribe(fn)); return () => u.forEach((x) => x()); }
    interpolate(c) { return new Interp(this, c); }
  }

  // ----- Animation runners -----
  const mk = (startFn, reset) => ({
    start(cb) {
      this._cb = cb;
      this._cancel = startFn((r) => { this._cancel = null; const c = this._cb; this._cb = null; c && c(r); });
    },
    stop() {
      if (this._cancel) { this._cancel(); this._cancel = null; const c = this._cb; this._cb = null; c && c({ finished: false }); }
    },
    reset() { reset && reset(); }
  });
  const timing = (value, opts) => {
    const { toValue, duration = 500, delay = 0, easing = Easing.inOut(Easing.ease) } = opts || {};
    if (isXY(value)) return parallel([timing(value.x, { ...opts, toValue: toValue.x }), timing(value.y, { ...opts, toValue: toValue.y })]);
    const v0 = value.__get();
    const a = mk((done) => {
      let raf, to;
      const from = value.__get();
      to = setTimeout(() => {
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / duration);
          value.setValue(from + (toValue - from) * easing(p));
          if (p < 1) raf = requestAnimationFrame(tick); else done({ finished: true });
        };
        raf = requestAnimationFrame(tick);
      }, delay);
      value._stop = () => a.stop();
      return () => { clearTimeout(to); cancelAnimationFrame(raf); };
    }, () => value.setValue(v0));
    return a;
  };
  const spring = (value, opts) => {
    const { toValue, stiffness = 100, damping = 10, mass = 1, velocity = 0 } = opts || {};
    if (isXY(value)) return parallel([spring(value.x, { ...opts, toValue: toValue.x }), spring(value.y, { ...opts, toValue: toValue.y })]);
    const v0 = value.__get();
    const a = mk((done) => {
      let x = value.__get(), v = velocity, last = performance.now(), raf;
      const tick = (now) => {
        const dt = Math.min(0.064, (now - last) / 1000); last = now;
        v += ((-stiffness * (x - toValue) - damping * v) / mass) * dt;
        x += v * dt;
        value.setValue(x);
        if (Math.abs(v) < 0.01 && Math.abs(x - toValue) < 0.01) { value.setValue(toValue); done({ finished: true }); }
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      value._stop = () => a.stop();
      return () => cancelAnimationFrame(raf);
    }, () => value.setValue(v0));
    return a;
  };
  const delayAnim = (ms) => mk((done) => { const t = setTimeout(() => done({ finished: true }), ms); return () => clearTimeout(t); });
  const sequence = (list) => mk((done) => {
    let i = 0;
    const next = () => {
      if (i >= list.length) return done({ finished: true });
      list[i++].start((r) => (r.finished ? next() : done(r)));
    };
    next();
    return () => list.forEach((a) => a.stop());
  }, () => list.forEach((a) => a.reset()));
  const parallel = (list) => mk((done) => {
    let n = 0, over = false;
    list.forEach((a) => a.start((r) => { if (over) return; if (!r.finished) { over = true; return done(r); } if (++n === list.length) done({ finished: true }); }));
    if (!list.length) done({ finished: true });
    return () => list.forEach((a) => a.stop());
  }, () => list.forEach((a) => a.reset()));
  const loop = (a, { iterations = -1 } = {}) => mk((done) => {
    let n = 0, stopped = false;
    const go = () => {
      if (stopped) return;
      if (iterations !== -1 && n >= iterations) return done({ finished: true });
      if (n++ > 0) a.reset();
      a.start((r) => { if (r.finished) go(); });
    };
    go();
    return () => { stopped = true; a.stop(); };
  });

  // ----- Animated components (re-render when a bound value changes) -----
  const resolve = (v) => Array.isArray(v) ? v.map(resolve) : isNode(v) ? v.__get() : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)])) : v;
  const collect = (v, out) => { if (isNode(v)) out.push(v); else if (Array.isArray(v)) v.forEach((x) => collect(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out)); return out; };
  const wrap = (C) => R.forwardRef(({ style, ...p }, ref) => {
    const [, tick] = R.useReducer((x) => x + 1, 0);
    const nodes = collect(style, []);
    R.useEffect(() => {
      let raf;
      const f = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
      const subs = nodes.map((n) => n.__subscribe(f));
      return () => { subs.forEach((u) => u()); cancelAnimationFrame(raf); };
    });
    return h(C, { ...p, ref, style: resolve(style) });
  });
  class DiffClampNode {
    constructor(node, min, max) { this.node = node; this.min = min; this.max = max; this._last = val(node); this._v = Math.min(max, Math.max(min, this._last)); }
    __get() {
      const n = val(this.node);
      this._v = Math.min(this.max, Math.max(this.min, this._v + (n - this._last)));
      this._last = n;
      return this._v;
    }
    __subscribe(f) { return this.node.__subscribe(f); }
    interpolate(c) { return new Interp(this, c); }
  }
  class ModuloNode {
    constructor(node, modulus) { this.node = node; this.modulus = modulus; }
    __get() { const v = val(this.node); return ((v % this.modulus) + this.modulus) % this.modulus; }
    __subscribe(f) { return this.node.__subscribe(f); }
    interpolate(c) { return new Interp(this, c); }
  }
  const decay = (value, { velocity = 0, deceleration = 0.997 } = {}) => {
    const v0 = value.__get();
    return mk((done) => {
      let x = v0, v = velocity, last = performance.now(), raf;
      const tick = (now) => {
        const dt = Math.min(0.064, (now - last) / 1000); last = now;
        v *= Math.pow(deceleration, dt * 1000);
        x += v * dt;
        value.setValue(x);
        if (Math.abs(v) < 0.05) done({ finished: true });
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, () => value.setValue(v0));
  };
  const mapEvent = (mapping, source) => {
    if (!mapping || source == null) return;
    Object.keys(mapping).forEach((key) => {
      const next = mapping[key];
      if (isNode(next) && next.setValue && source && typeof source[key] === 'number') next.setValue(source[key]);
      else if (next && typeof next === 'object') mapEvent(next, source && source[key]);
    });
  };
  const Animated = {
    Value, ValueXY, timing, spring, decay, sequence, parallel, loop, delay: delayAnim,
    stagger: (ms, list) => parallel(list.map((a, i) => sequence([delayAnim(ms * i), a]))),
    add: (a, b) => new Op(a, b, (x, y) => x + y), subtract: (a, b) => new Op(a, b, (x, y) => x - y),
    multiply: (a, b) => new Op(a, b, (x, y) => x * y), divide: (a, b) => new Op(a, b, (x, y) => x / y),
    diffClamp: (node, min, max) => new DiffClampNode(node, min, max),
    modulo: (node, modulus) => new ModuloNode(node, modulus),
    event: (mapping) => (e) => (mapping || []).forEach((item) => mapEvent(item, e)),
    createAnimatedComponent: wrap,
    View: wrap(RN.View), Text: wrap(RN.Text), Image: wrap(RN.Image), ScrollView: wrap(RN.ScrollView), FlatList: wrap(RN.FlatList)
  };

  // ----- Modal (portal into the phone screen) -----
  // `visible` is the React Native prop. `isVisible` is accepted too, since that
  // is the name used by react-native-modal and a common mix-up. Closed by default.
  const Modal = ({ visible, isVisible, transparent, animationType = 'none', onRequestClose, onShow, children }) => {
    const open = visible != null ? !!visible : isVisible != null ? !!isVisible : false;
    const root = document.getElementById('modal-root');
    const [present, setPresent] = R.useState(open);
    const [phase, setPhase] = R.useState(open ? 'in' : 'out');
    R.useEffect(() => {
      if (open) {
        setPresent(true);
        setPhase('in');
        return;
      }
      setPhase('out');
      const ms = animationType === 'slide' ? 280 : animationType === 'fade' ? 200 : 0;
      const t = setTimeout(() => setPresent(false), ms);
      return () => clearTimeout(t);
    }, [open, animationType]);
    R.useEffect(() => { if (open && onShow) onShow(); }, [open]);
    R.useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === 'Escape' && onRequestClose) onRequestClose(); };
      window.addEventListener('keydown', onKey);
      const sub = onRequestClose ? BackHandler.addEventListener('hardwareBackPress', () => { onRequestClose(); return true; }) : null;
      return () => {
        window.removeEventListener('keydown', onKey);
        if (sub) sub.remove();
      };
    }, [open, onRequestClose]);
    if (!present || !root) return null;
    const closing = phase === 'out' && !open;
    const anim = animationType === 'slide'
      ? (closing ? 'rn-slide-down .28s ease-in both' : 'rn-slide-up .28s ease-out both')
      : animationType === 'fade'
        ? (closing ? 'rn-fade-out .2s ease-in both' : 'rn-fade .2s ease-out both')
        : 'none';
    const screen = document.getElementById('emulator-screen');
    return ReactDOM.createPortal(h('div', {
      style: {
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto', animation: anim,
        backgroundColor: transparent ? 'transparent' : (window.__scheme === 'dark' ? '#020617' : '#ffffff'),
        color: screen ? screen.style.color : 'inherit'
      }
    }, children), root);
  };

  // ----- SectionList -----
  const SectionList = ({ sections = [], renderItem, renderSectionHeader, renderSectionFooter, keyExtractor, ItemSeparatorComponent, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, style, contentContainerStyle, ...p }) => {
    const kids = [];
    const F = (k, c) => h(R.Fragment, { key: k }, c);
    if (ListHeaderComponent) kids.push(F('__h', rm(ListHeaderComponent)));
    if (!sections.length && ListEmptyComponent) kids.push(F('__e', rm(ListEmptyComponent)));
    sections.forEach((s, si) => {
      if (renderSectionHeader) kids.push(F('sh' + si, renderSectionHeader({ section: s })));
      s.data.forEach((item, i) => {
        const ke = s.keyExtractor || keyExtractor;
        const k = si + '-' + (ke ? ke(item, i) : item && item.id != null ? item.id : i);
        kids.push(F(k, renderItem({ item, index: i, section: s })));
        if (ItemSeparatorComponent && i < s.data.length - 1) kids.push(F(k + 's', rm(ItemSeparatorComponent)));
      });
      if (renderSectionFooter) kids.push(F('sf' + si, renderSectionFooter({ section: s })));
    });
    if (ListFooterComponent) kids.push(F('__f', rm(ListFooterComponent)));
    return h(RN.ScrollView, { style, contentContainerStyle, ...p }, kids);
  };

  // ----- Touchables, Button, ImageBackground -----
  const TouchableHighlight = ({ underlayColor, style, ...p }) => h(RN.Pressable, { ...p, style: ({ pressed }) => [style, pressed && { backgroundColor: underlayColor || '#cccccc' }] });
  const TouchableWithoutFeedback = ({ onPress, children }) => R.cloneElement(R.Children.only(children), { onClick: onPress });
  const Button = ({ title, onPress, color, disabled }) => currentDevice === 'android'
    ? h(RN.TouchableOpacity, { onPress, disabled, style: { backgroundColor: color || '#2196F3', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 2, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.3)' } }, h(RN.Text, { style: { color: '#fff', fontWeight: '500', fontSize: 14 } }, String(title).toUpperCase()))
    : h(RN.TouchableOpacity, { onPress, disabled }, h(RN.Text, { style: { color: color || '#007AFF', fontSize: 18, textAlign: 'center', padding: 8 } }, title));
  const ImageBackground = ({ source, style, imageStyle, resizeMode, children }) => h(RN.View, { style }, h(RN.Image, { source, resizeMode, style: [{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }, imageStyle] }), children);

  // ----- Appearance -----
  window.__scheme = 'light';
  const al = new Set();
  const Appearance = {
    getColorScheme: () => window.__scheme,
    addChangeListener: (f) => { al.add(f); return { remove: () => al.delete(f) }; },
    set: (s) => { window.__scheme = s; al.forEach((f) => f({ colorScheme: s })); }
  };
  window.rnAppearance = Appearance;
  const useColorScheme = () => {
    const [s, set] = R.useState(Appearance.getColorScheme());
    R.useEffect(() => { const l = Appearance.addChangeListener(({ colorScheme }) => set(colorScheme)); return () => l.remove(); }, []);
    return s;
  };

  // ----- Keyboard (events + on-screen keyboard) -----
  const kl = {};
  const Keyboard = {
    dismiss: () => { const a = document.activeElement; a && a.blur && a.blur(); },
    addListener: (ev, f) => { (kl[ev] = kl[ev] || new Set()).add(f); return { remove: () => kl[ev].delete(f) }; },
    emit: (ev, e) => kl[ev] && kl[ev].forEach((f) => f(e)),
    isVisible: () => !!window.__kbOpen
  };
  (function setupKeyboard() {
    const screen = document.getElementById('emulator-screen');
    const panel = document.getElementById('kb-panel');
    const isField = (el) => el && el.dataset && el.dataset.kb && /^(INPUT|TEXTAREA)$/.test(el.tagName);
    let shift = false;
    let caps = false;
    let layer = 'letters';
    let hold = null;
    let lastShift = 0;

    const family = (type) => {
      if (type === 'number-pad' || type === 'decimal-pad' || type === 'phone-pad') return type;
      if (type === 'numeric' || type === 'numbers-and-punctuation') return 'numeric';
      if (type === 'email-address') return 'email';
      if (type === 'url') return 'url';
      if (type === 'twitter') return 'twitter';
      if (type === 'web-search') return 'search';
      if (type === 'name-phone-pad') return 'name-phone';
      return 'default';
    };
    const returnLabel = (el) => {
      const key = (el && el.dataset.returnKey) || '';
      if (key === 'search' || family(el && el.dataset.kb) === 'search') return 'search';
      if (key === 'go' || family(el && el.dataset.kb) === 'url') return 'go';
      if (key === 'send') return 'send';
      if (key === 'next') return 'next';
      if (key === 'done' || key === '') return 'done';
      return key;
    };
    const setNative = (el, value) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const placeCaret = (el, pos) => {
      requestAnimationFrame(() => {
        if (document.activeElement !== el || !el.setSelectionRange) return;
        const p = Math.max(0, Math.min(pos, el.value.length));
        el.setSelectionRange(p, p);
      });
    };
    const insert = (el, text) => {
      const start = el.selectionStart == null ? el.value.length : el.selectionStart;
      const end = el.selectionEnd == null ? el.value.length : el.selectionEnd;
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      if (el.maxLength > 0 && next.length > el.maxLength) return;
      setNative(el, next);
      placeCaret(el, start + text.length);
    };
    const backspace = (el) => {
      const start = el.selectionStart == null ? el.value.length : el.selectionStart;
      const end = el.selectionEnd == null ? el.value.length : el.selectionEnd;
      if (start !== end) {
        setNative(el, el.value.slice(0, start) + el.value.slice(end));
        placeCaret(el, start);
      } else if (start > 0) {
        setNative(el, el.value.slice(0, start - 1) + el.value.slice(end));
        placeCaret(el, start - 1);
      }
    };
    const wantsShift = (el) => {
      const mode = (el && el.dataset.cap) || 'sentences';
      if (mode === 'none') return false;
      if (mode === 'characters') return 'caps';
      const before = el.value.slice(0, el.selectionStart == null ? el.value.length : el.selectionStart);
      if (mode === 'words') return before.length === 0 || /\s$/.test(before);
      return before.length === 0 || /[.!?]\s$/.test(before);
    };
    const charKey = (ch, flex) => ({ t: ch, insert: ch, flex: flex || 1, kind: 'char' });
    const actionKey = (t, action, flex, kind) => ({ t, action, flex: flex || 1, kind: kind || 'mod' });
    const letterRows = (bottom) => {
      const up = (ch) => (shift || caps) && ch.length === 1 ? ch.toUpperCase() : ch;
      const row = (chars) => chars.map((ch) => charKey(up(ch)));
      return [
        row('qwertyuiop'.split('')),
        row('asdfghjkl'.split('')),
        [actionKey(caps ? '⇪' : '⇧', 'shift', 1.35, 'shift'), ...row('zxcvbnm'.split('')), actionKey('⌫', 'backspace', 1.35)],
        bottom
      ];
    };
    const symbolRows = (which) => which === 'symbols'
      ? [
          '[]{}#%^*+='.split('').map((ch) => charKey(ch)),
          ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'].map((ch) => charKey(ch)),
          [actionKey('123', 'numbers', 1.4), ...'.,?!\'"'.split('').map((ch) => charKey(ch)), actionKey('⌫', 'backspace', 1.35)],
          [actionKey('ABC', 'letters', 1.5), actionKey('', 'space', 4, 'space'), actionKey('done', 'return', 1.7, 'return')]
        ]
      : [
          '1234567890'.split('').map((ch) => charKey(ch)),
          '-/:;()$&@"'.split('').map((ch) => charKey(ch)),
          [actionKey('#+=', 'symbols', 1.4), ...'.,?!\''.split('').map((ch) => charKey(ch)), actionKey('⌫', 'backspace', 1.35)],
          [actionKey('ABC', 'letters', 1.5), actionKey('', 'space', 4, 'space'), actionKey('done', 'return', 1.7, 'return')]
        ];
    const pad = (rows) => rows;
    const rowsFor = (el) => {
      const kind = family(el && el.dataset.kb);
      const ret = actionKey(returnLabel(el), 'return', 1.7, 'return');
      const space = actionKey('', 'space', 4, 'space');
      if (kind === 'number-pad') {
        return pad([
          [charKey('1'), charKey('2'), charKey('3')],
          [charKey('4'), charKey('5'), charKey('6')],
          [charKey('7'), charKey('8'), charKey('9')],
          [actionKey('', 'blank', 1, 'blank'), charKey('0'), actionKey('⌫', 'backspace', 1)]
        ]);
      }
      if (kind === 'decimal-pad') {
        return pad([
          [charKey('1'), charKey('2'), charKey('3')],
          [charKey('4'), charKey('5'), charKey('6')],
          [charKey('7'), charKey('8'), charKey('9')],
          [charKey('.'), charKey('0'), actionKey('⌫', 'backspace', 1)]
        ]);
      }
      if (kind === 'phone-pad' || (kind === 'name-phone' && layer === 'phone')) {
        return pad([
          [charKey('1'), charKey('2'), charKey('3')],
          [charKey('4'), charKey('5'), charKey('6')],
          [charKey('7'), charKey('8'), charKey('9')],
          [charKey('*'), charKey('0'), charKey('#')],
          [kind === 'name-phone' ? actionKey('ABC', 'letters', 1) : charKey('+'), actionKey('⌫', 'backspace', 1), ret]
        ]);
      }
      if (kind === 'numeric' || layer === 'numbers' || layer === 'symbols') return symbolRows(layer === 'symbols' ? 'symbols' : 'numbers').map((row, i, all) => i === all.length - 1 ? [actionKey('ABC', 'letters', 1.5), space, ret] : row);
      const extra = kind === 'email' ? [actionKey('123', 'numbers', 1.3), charKey('@', 1.2), space, charKey('.', 1.1), ret]
        : kind === 'url' ? [actionKey('123', 'numbers', 1.2), charKey('.', 1), charKey('/', 1), charKey('.com', 1.5), ret]
        : kind === 'twitter' ? [actionKey('123', 'numbers', 1.3), charKey('@', 1.1), space, charKey('#', 1.1), ret]
        : kind === 'name-phone' ? [actionKey('123', 'phone', 1.4), space, ret]
        : [actionKey('123', 'numbers', 1.4), space, ret];
      return letterRows(extra);
    };

    const render = (el) => {
      clearInterval(hold);
      hold = null;
      const android = currentDevice === 'android';
      const kind = family(el && el.dataset.kb);
      const isPad = kind === 'number-pad' || kind === 'decimal-pad' || kind === 'phone-pad' || (kind === 'name-phone' && layer === 'phone');
      panel.className = 'rn-kb' + (android ? ' android' : ' ios') + (isDarkPreview ? ' dark' : '') + (isPad ? ' pad' : '');
      panel.innerHTML = '';
      rowsFor(el).forEach((keys) => {
        const line = document.createElement('div');
        line.className = 'rn-kb-row';
        keys.forEach((key) => {
          if (key.kind === 'blank') {
            const gap = document.createElement('div');
            gap.style.flex = String(key.flex);
            line.appendChild(gap);
            return;
          }
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'rn-key' + (key.kind === 'char' ? '' : ' ' + key.kind) + (key.action === 'shift' && (shift || caps) ? ' on' : '');
          button.style.flex = String(key.flex);
          button.textContent = key.t === '' && key.action === 'space' ? 'space' : key.t;
          const fire = () => {
            const field = document.activeElement;
            if (!isField(field)) return;
            if (key.action === 'shift') {
              const now = Date.now();
              if (now - lastShift < 320) { caps = !caps; shift = caps; }
              else { caps = false; shift = !shift; }
              lastShift = now;
              render(field);
              return;
            }
            if (key.action === 'backspace') { backspace(field); return; }
            if (key.action === 'space') { insert(field, ' '); if (!caps) { shift = !!wantsShift(field); render(field); } return; }
            if (key.action === 'return') {
              if (field.tagName === 'TEXTAREA') insert(field, '\n');
              else {
                field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                if (document.activeElement === field) field.blur();
                setTimeout(() => { if (!isField(document.activeElement)) hide(); }, 0);
              }
              return;
            }
            if (key.action === 'numbers') { layer = 'numbers'; render(field); return; }
            if (key.action === 'symbols') { layer = 'symbols'; render(field); return; }
            if (key.action === 'letters') { layer = 'letters'; render(field); return; }
            if (key.action === 'phone') { layer = 'phone'; render(field); return; }
            const text = key.insert || key.t;
            insert(field, text);
            if (shift && !caps && text.length === 1 && /[a-z]/i.test(text)) { shift = false; render(field); }
          };
          button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            button.classList.add('down');
            fire();
            if (key.action === 'backspace') {
              hold = setTimeout(() => { hold = setInterval(() => backspace(document.activeElement), 45); }, 320);
            }
          });
          const release = () => { button.classList.remove('down'); clearTimeout(hold); clearInterval(hold); hold = null; };
          button.addEventListener('pointerup', release);
          button.addEventListener('pointerleave', release);
          button.addEventListener('pointercancel', release);
          line.appendChild(button);
        });
        panel.appendChild(line);
      });
    };

    const reveal = (el) => {
      let node = el.parentElement;
      while (node && node !== screen) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 4) {
          const box = node.getBoundingClientRect();
          const field = el.getBoundingClientRect();
          if (field.bottom > box.bottom - 6) node.scrollTop += field.bottom - box.bottom + 14;
          if (field.top < box.top + 6) node.scrollTop -= box.top - field.top + 14;
        }
        node = node.parentElement;
      }
    };
    const show = (el) => {
      const next = wantsShift(el);
      caps = next === 'caps';
      shift = caps || next === true;
      layer = 'letters';
      render(el);
      const was = window.__kbOpen;
      window.__kbOpen = true;
      panel.style.display = 'flex';
      requestAnimationFrame(() => reveal(el));
      if (!was) Keyboard.emit('keyboardDidShow', { endCoordinates: { height: panel.offsetHeight, width: panel.offsetWidth, screenX: 0, screenY: 0 } });
    };
    const hide = () => {
      if (!window.__kbOpen) return;
      window.__kbOpen = false;
      panel.style.display = 'none';
      Keyboard.emit('keyboardDidHide', {});
    };
    window.__kbRerender = () => { if (isField(document.activeElement)) render(document.activeElement); };
    window.__kbHide = hide;
    Keyboard.dismiss = () => {
      const active = document.activeElement;
      if (active && active.blur) active.blur();
      hide();
    };
    screen.addEventListener('focusin', (e) => { if (isField(e.target)) show(e.target); });
    screen.addEventListener('focusout', () => setTimeout(() => { if (!isField(document.activeElement)) hide(); }, 40));
  })();

  // ----- Misc APIs -----
  const linkListeners = new Set();
  const Linking = {
    openURL: async (u) => { window.open(u, '_blank', 'noopener'); },
    canOpenURL: async () => true,
    getInitialURL: async () => null,
    openSettings: async () => console.log('[Linking] openSettings'),
    sendIntent: async () => {},
    addEventListener: (type, fn) => { linkListeners.add(fn); return { remove() { linkListeners.delete(fn); } }; }
  };
  const Vibration = { vibrate: (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} console.log('[Vibration]', p || 400); window.shakePhone && window.shakePhone(); }, cancel: () => { try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} } };
  const Share = {
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
    share: async (o) => {
      if (navigator.share) { try { await navigator.share({ title: o.title, text: o.message, url: o.url }); } catch (e) { return { action: 'dismissedAction' }; } }
      else console.log('[Share]', o.message || o.url);
      return { action: 'sharedAction' };
    }
  };
  const PixelRatio = {
    get: () => (typeof DEVICES !== 'undefined' && DEVICES[deviceKey] && DEVICES[deviceKey].dpr) || window.devicePixelRatio || 2,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize(x) { return Math.round(x * this.get()); },
    roundToNearestPixel(x) { const r = this.get(); return Math.round(x * r) / r; }
  };
  const LayoutAnimation = {
    configureNext() {
      const root = document.getElementById('app-root');
      if (!root) return;
      root.classList.add('rn-layout-anim');
      setTimeout(() => root.classList.remove('rn-layout-anim'), 320);
    },
    create: () => ({}),
    Presets: { easeInEaseOut: {}, linear: {}, spring: {} },
    Types: { spring: 'spring', linear: 'linear', easeInEaseOut: 'easeInEaseOut', easeIn: 'easeIn', easeOut: 'easeOut' },
    Properties: { opacity: 'opacity', scaleX: 'scaleX', scaleY: 'scaleY' }
  };
  const backStack = [];
  const BackHandler = {
    addEventListener(type, fn) { backStack.push(fn); return { remove() { const i = backStack.indexOf(fn); if (i >= 0) backStack.splice(i, 1); } }; },
    exitApp() { console.log('[BackHandler] exitApp'); if (window.goHome) window.goHome(); }
  };
  window.__rnBack = () => {
    for (let i = backStack.length - 1; i >= 0; i--) { if (backStack[i]()) return true; }
    return false;
  };
  const appListeners = new Set();
  const AppState = {
    currentState: document.hidden ? 'background' : 'active',
    addEventListener(type, fn) {
      const wrap = () => { AppState.currentState = document.hidden ? 'background' : 'active'; fn(AppState.currentState); };
      document.addEventListener('visibilitychange', wrap);
      appListeners.add(wrap);
      return { remove() { document.removeEventListener('visibilitychange', wrap); appListeners.delete(wrap); } };
    },
    removeEventListener(type, fn) { fn && appListeners.delete(fn); }
  };
  const I18nManager = {
    isRTL: false,
    doLeftAndRightSwapInRTL: true,
    allowRTL() {},
    forceRTL(v) { this.isRTL = !!v; const screen = document.getElementById('emulator-screen'); if (screen) screen.dir = v ? 'rtl' : 'ltr'; },
    swapLeftAndRightInRTL(v) { this.doLeftAndRightSwapInRTL = !!v; }
  };
  const RefreshControl = () => null;
  const KeyboardAvoidingView = ({ behavior, keyboardVerticalOffset = 0, style, children, ...props }) => {
    const [kb, setKb] = R.useState(0);
    R.useEffect(() => {
      const show = Keyboard.addListener('keyboardDidShow', (e) => setKb((e.endCoordinates && e.endCoordinates.height) || 240));
      const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0));
      return () => { show.remove(); hide.remove(); };
    }, []);
    const extra = {};
    if (kb) {
      if (behavior === 'padding') extra.paddingBottom = kb + keyboardVerticalOffset;
      else if (behavior === 'position') extra.bottom = kb + keyboardVerticalOffset;
      else if (behavior === 'height') extra.maxHeight = '100%';
    }
    return h(RN.View, { ...props, style: [style, extra, behavior === 'position' && kb ? { position: 'relative' } : null] }, children);
  };
  const InputAccessoryView = ({ children }) => {
    const [open, setOpen] = R.useState(false);
    R.useEffect(() => {
      const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
      const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
      return () => { show.remove(); hide.remove(); };
    }, []);
    const panel = document.getElementById('kb-panel');
    if (!open || !panel) return null;
    return ReactDOM.createPortal(h('div', { style: { background: '#d1d5db', padding: '6px 8px' } }, children), panel);
  };
  const DrawerLayoutAndroid = R.forwardRef(({ drawerWidth = 280, renderNavigationView, children, drawerPosition = 'left' }, ref) => {
    const [open, setOpen] = R.useState(false);
    R.useImperativeHandle(ref, () => ({ openDrawer: () => setOpen(true), closeDrawer: () => setOpen(false) }));
    return h(RN.View, { style: { flex: 1, overflow: 'hidden' } },
      children,
      open ? h(RN.Pressable, { onPress: () => setOpen(false), style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,.35)' } }) : null,
      open ? h(RN.View, { style: { position: 'absolute', top: 0, bottom: 0, width: drawerWidth, backgroundColor: '#fff', [drawerPosition]: 0 } }, renderNavigationView && renderNavigationView()) : null
    );
  });
  const ProgressBarAndroid = ({ progress = 0, indeterminate, color = '#2196F3', style }) => h(RN.View, {
    style: [{ height: 4, backgroundColor: '#e5e7eb', overflow: 'hidden', borderRadius: 2 }, style]
  }, h(RN.View, { style: { width: indeterminate ? '40%' : Math.max(0, Math.min(1, progress)) * 100 + '%', height: '100%', backgroundColor: color } }));

  const makeEmitter = () => {
    const map = {};
    return {
      addListener(ev, fn) { (map[ev] = map[ev] || new Set()).add(fn); const sub = { remove() { map[ev] && map[ev].delete(fn); } }; return sub; },
      removeAllListeners(ev) { if (ev) delete map[ev]; else Object.keys(map).forEach((k) => delete map[k]); },
      emit(ev, ...args) { map[ev] && map[ev].forEach((fn) => fn(...args)); },
      listenerCount(ev) { return map[ev] ? map[ev].size : 0; }
    };
  };
  const DeviceEventEmitter = makeEmitter();
  class NativeEventEmitter {
    constructor() { this._e = makeEmitter(); }
    addListener(ev, fn) { return this._e.addListener(ev, fn); }
    removeAllListeners(ev) { this._e.removeAllListeners(ev); }
    emit(ev, ...args) { this._e.emit(ev, ...args); }
  }
  const nodeIds = new WeakMap();
  let nodeSeq = 1;
  const hostNode = (node) => (node && node.current != null ? node.current : node);
  const findNodeHandle = (node) => {
    const el = hostNode(node);
    if (!el || el.nodeType !== 1) return null;
    if (!nodeIds.has(el)) nodeIds.set(el, nodeSeq++);
    return nodeIds.get(el);
  };
  const measureNode = (node) => {
    const el = hostNode(node);
    if (!el || !el.getBoundingClientRect) return null;
    return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, pageX: el.offsetLeft, pageY: el.offsetTop };
  };
  const UIManager = {
    measure(node, cb) { const m = measureNode(node); cb(m ? m.x : 0, m ? m.y : 0, m ? m.w : 0, m ? m.h : 0, m ? m.pageX : 0, m ? m.pageY : 0); },
    measureInWindow(node, cb) { const m = measureNode(node); cb(m ? m.pageX : 0, m ? m.pageY : 0, m ? m.w : 0, m ? m.h : 0); },
    measureLayout(node, relative, onFail, onSuccess) { const m = measureNode(node); if (!m) onFail(); else onSuccess(m.x, m.y, m.w, m.h); },
    setLayoutAnimationEnabledExperimental() {},
    getViewManagerConfig() { return null; },
    getConstants() { return {}; }
  };
  const nativeMod = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      const bag = new Proxy({}, { get: (_, key) => (key === 'then' ? undefined : () => Promise.resolve(null)) });
      target[prop] = bag;
      return bag;
    }
  };
  const NativeModules = new Proxy({}, nativeMod);
  const TurboModuleRegistry = { get: () => null, getEnforcing: (name) => NativeModules[name] };
  const InteractionManager = {
    runAfterInteractions: (task) => { const id = setTimeout(task, 0); return { then(fn) { return Promise.resolve().then(fn); }, cancel() { clearTimeout(id); } }; },
    createInteractionHandle: () => 1,
    clearInteractionHandle() {},
    setDeadline() {}
  };
  let toastTimer = null;
  const showToast = (message, duration) => {
    const screen = document.getElementById('emulator-screen');
    if (!screen) { console.log('[Toast]', message); return; }
    let el = document.getElementById('rn-toast');
    if (!el) { el = document.createElement('div'); el.id = 'rn-toast'; screen.appendChild(el); }
    el.textContent = String(message);
    el.style.cssText = 'position:absolute;left:50%;bottom:56px;transform:translateX(-50%);max-width:80%;background:rgba(17,24,39,.92);color:#fff;padding:8px 14px;border-radius:18px;font:13px Inter,sans-serif;z-index:80;pointer-events:none;text-align:center';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), duration === 1 ? 3500 : 2000);
  };
  const ToastAndroid = { SHORT: 0, LONG: 1, TOP: 49, BOTTOM: 81, CENTER: 17, show: (m, d) => showToast(m, d), showWithGravity: (m, d) => showToast(m, d) };
  const Clipboard = {
    getString: async () => { try { return await navigator.clipboard.readText(); } catch (e) { return ''; } },
    setString: (text) => { const value = String(text); try { navigator.clipboard.writeText(value); } catch (e) {} console.log('[Clipboard]', value); }
  };
  const settingsBag = {};
  const Settings = { get: (k) => settingsBag[k], set: (o) => Object.assign(settingsBag, o), watchKeys: () => ({ remove() {} }) };
  const PermissionsAndroid = {
    RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
    PERMISSIONS: { CAMERA: 'android.permission.CAMERA', RECORD_AUDIO: 'android.permission.RECORD_AUDIO', ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION', ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION', READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE', WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE', POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS', READ_CONTACTS: 'android.permission.READ_CONTACTS' },
    request: async () => 'granted',
    requestMultiple: async (perms) => Object.fromEntries(perms.map((p) => [p, 'granted'])),
    check: async () => true
  };
  const AccessibilityInfo = {
    isScreenReaderEnabled: async () => false,
    isBoldTextEnabled: async () => false,
    isReduceMotionEnabled: async () => false,
    announceForAccessibility: (msg) => console.log('[Accessibility]', msg),
    setAccessibilityFocus() {},
    addEventListener: () => ({ remove() {} })
  };
  const ActionSheetIOS = {
    showActionSheetWithOptions(options, callback) {
      const root = document.getElementById('modal-root');
      if (!root) { callback && callback(options.cancelButtonIndex || 0); return; }
      const ov = document.createElement('div');
      ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;pointer-events:auto;z-index:8';
      const sheet = document.createElement('div');
      sheet.style.cssText = 'width:100%;max-width:420px;margin:8px;background:' + (isDarkPreview ? '#1c1c1e' : '#fff') + ';color:' + (isDarkPreview ? '#fff' : '#111') + ';border-radius:14px;overflow:hidden;font-family:Inter,sans-serif';
      if (options.title) {
        const t = document.createElement('div');
        t.textContent = options.title;
        t.style.cssText = 'padding:12px;text-align:center;font-weight:600';
        sheet.appendChild(t);
      }
      (options.options || []).forEach((label, index) => {
        const row = document.createElement('div');
        row.textContent = label;
        const destructive = index === options.destructiveButtonIndex;
        row.style.cssText = 'padding:14px;text-align:center;border-top:1px solid rgba(128,128,128,.3);cursor:pointer;color:' + (destructive ? '#ff3b30' : '#0a84ff');
        row.onclick = () => { ov.remove(); callback && callback(index); };
        sheet.appendChild(row);
      });
      ov.appendChild(sheet);
      root.appendChild(ov);
    },
    showShareActionSheetWithOptions(options, failure, success) { if (success) success(true, 'shared'); }
  };
  const apps = {};
  let lastApp = null;
  const AppRegistry = {
    registerComponent(name, getComponent) { apps[name] = getComponent; lastApp = name; return name; },
    getApplication(name) { const get = apps[name || lastApp]; return get ? get() : null; },
    runApplication() {},
    unmountApplicationComponentAtRootTag() {}
  };
  window.__rnAppRegistry = AppRegistry;
  const LogBox = { ignoreLogs() {}, ignoreAllLogs() {}, install() {}, uninstall() {} };
  const DevSettings = { addMenuItem() {}, reload() { if (window.runCode) window.runCode(true); } };
  const processColor = (color) => color;
  const PlatformColor = (...names) => names[0] || 'black';
  const DynamicColorIOS = ({ light, dark }) => (window.__scheme === 'dark' ? dark : light);
  const Systrace = { beginSection() {}, endSection() {}, measure: (name, fn) => fn() };
  const codegenNativeComponent = () => RN.View;
  const codegenNativeCommands = () => ({});
  const unstable_batchedUpdates = (fn, arg) => fn(arg);
  RN.Alert.prompt = (title, message, callbackOrButtons, type, defaultValue) => {
    window.showNativePrompt && window.showNativePrompt(title, message, callbackOrButtons, defaultValue);
  };
  RN.StatusBar.currentHeight = 24;
  RN.StatusBar.setTranslucent = () => {};
  RN.StatusBar.pushStackEntry = (p) => p;
  RN.StatusBar.popStackEntry = () => {};
  Keyboard.metrics = () => (window.__kbOpen ? { height: 240, screenX: 0, screenY: 0, width: 0 } : null);
  Keyboard.scheduleLayoutAnimation = () => {};
  const VirtualizedList = ({ data, getItem, getItemCount, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, ...rest }) => {
    const count = getItemCount ? getItemCount(data) : (data ? data.length : 0);
    const kids = [];
    if (ListHeaderComponent) kids.push(h(R.Fragment, { key: 'h' }, rm(ListHeaderComponent)));
    if (!count && ListEmptyComponent) kids.push(h(R.Fragment, { key: 'e' }, rm(ListEmptyComponent)));
    for (let i = 0; i < count; i++) {
      const item = getItem ? getItem(data, i) : data[i];
      const key = keyExtractor ? keyExtractor(item, i) : String(i);
      kids.push(h(R.Fragment, { key }, renderItem({ item, index: i })));
    }
    if (ListFooterComponent) kids.push(h(R.Fragment, { key: 'f' }, rm(ListFooterComponent)));
    return h(RN.ScrollView, rest, kids);
  };
  const PanResponder = {
    create: (cfg) => {
      let g = {}, s = () => window.__deviceScale || 1;
      const move = (e) => { g = { ...g, dx: (e.clientX - g.x0) / s(), dy: (e.clientY - g.y0) / s(), moveX: e.clientX, moveY: e.clientY }; cfg.onPanResponderMove && cfg.onPanResponderMove({ nativeEvent: e }, g); };
      const up = (e) => {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        cfg.onPanResponderRelease && cfg.onPanResponderRelease({ nativeEvent: e }, g);
        cfg.onPanResponderEnd && cfg.onPanResponderEnd({ nativeEvent: e }, g);
      };
      return { panHandlers: { onMouseDown: (e) => {
        g = { dx: 0, dy: 0, x0: e.clientX, y0: e.clientY, moveX: e.clientX, moveY: e.clientY };
        cfg.onPanResponderGrant && cfg.onPanResponderGrant({ nativeEvent: e }, g);
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      } } };
    }
  };

  // ----- AsyncStorage (backed by localStorage) + a few common module shims -----
  const ls = { get: (k) => { try { return localStorage.getItem('rn:' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('rn:' + k, v); } catch (e) {} }, del: (k) => { try { localStorage.removeItem('rn:' + k); } catch (e) {} }, keys: () => { try { return Object.keys(localStorage).filter((k) => k.startsWith('rn:')).map((k) => k.slice(3)); } catch (e) { return []; } } };
  const AsyncStorage = {
    getItem: async (k) => ls.get(k), setItem: async (k, v) => ls.set(k, String(v)), removeItem: async (k) => ls.del(k),
    getAllKeys: async () => ls.keys(), clear: async () => ls.keys().forEach(ls.del),
    multiGet: async (ks) => ks.map((k) => [k, ls.get(k)]), multiSet: async (ps) => ps.forEach(([k, v]) => ls.set(k, String(v)))
  };
  // Chrome (notch, status bar, home button) sits outside the app, so the app box is already the safe area.
  const insets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
  const modules = {
    '@react-native-async-storage/async-storage': { ...AsyncStorage, default: AsyncStorage, __esModule: true },
    '@react-native-clipboard/clipboard': { ...Clipboard, default: Clipboard, __esModule: true },
    '@react-native-community/netinfo': {
      fetch: async () => ({ isConnected: navigator.onLine, isInternetReachable: navigator.onLine, type: navigator.onLine ? 'wifi' : 'none', details: {} }),
      addEventListener: () => () => {},
      __esModule: true
    },
    'react-native-safe-area-context': { SafeAreaProvider: ({ children }) => children, SafeAreaView: RN.SafeAreaView, useSafeAreaInsets: insets, useSafeAreaFrame: () => RN.Dimensions.get('window'), __esModule: true },
    'expo-status-bar': { StatusBar: RN.StatusBar, __esModule: true }
  };

  return {
    Animated, Easing, Modal, SectionList, VirtualizedList, VirtualizedSectionList: SectionList,
    TouchableHighlight, TouchableWithoutFeedback, TouchableNativeFeedback: RN.TouchableOpacity,
    Button, ImageBackground, Appearance, useColorScheme, Keyboard, KeyboardAvoidingView, InputAccessoryView,
    DrawerLayoutAndroid, ProgressBarAndroid, Linking, Vibration, Share, PixelRatio, LayoutAnimation,
    BackHandler, AppState, I18nManager, RefreshControl, PanResponder, NativeModules, UIManager,
    DeviceEventEmitter, NativeEventEmitter, findNodeHandle, InteractionManager, TurboModuleRegistry,
    Clipboard, Settings, PermissionsAndroid, AccessibilityInfo, ActionSheetIOS, AppRegistry, LogBox,
    YellowBox: LogBox, DevSettings, ToastAndroid, processColor, PlatformColor, DynamicColorIOS, Systrace,
    codegenNativeComponent, codegenNativeCommands, unstable_batchedUpdates, __modules: modules
  };
}


const RNComponents = createRNPrimitives();
Object.assign(RNComponents, createRNExtras(RNComponents));
RNComponents.default = RNComponents;
window.RNComponents = RNComponents;

const DEVICES = {
  // ===== iPhone (Dynamic Island) =====
  iphone16promax: { n: 'iPhone 16 Pro Max', w: 440, h: 956, os: 'iphone', r: 55, type: 'island', sb: 62, dpr: 3 },
  iphone16pro:    { n: 'iPhone 16 Pro',     w: 402, h: 874, os: 'iphone', r: 55, type: 'island', sb: 62, dpr: 3 },
  iphone16:       { n: 'iPhone 16',         w: 393, h: 852, os: 'iphone', r: 50, type: 'island', sb: 59, dpr: 3 },
  iphone15promax: { n: 'iPhone 15 Pro Max', w: 430, h: 932, os: 'iphone', r: 50, type: 'island', sb: 59, dpr: 3 },
  iphone15pro:    { n: 'iPhone 15 Pro',     w: 393, h: 852, os: 'iphone', r: 50, type: 'island', sb: 59, dpr: 3 },
  iphone15:       { n: 'iPhone 15',         w: 393, h: 852, os: 'iphone', r: 50, type: 'island', sb: 59, dpr: 3 },
  iphone14pro:    { n: 'iPhone 14 Pro',     w: 393, h: 852, os: 'iphone', r: 47, type: 'island', sb: 54, dpr: 3 },

  // ===== iPhone (Notch) =====
  iphone14:       { n: 'iPhone 14',         w: 390, h: 844, os: 'iphone', r: 47, type: 'notch',  sb: 47, dpr: 3 },
  iphone13:       { n: 'iPhone 13',         w: 390, h: 844, os: 'iphone', r: 47, type: 'notch',  sb: 47, dpr: 3 },
  iphone13mini:   { n: 'iPhone 13 mini',    w: 375, h: 812, os: 'iphone', r: 44, type: 'notch',  sb: 50, dpr: 3 },

  // ===== iPhone (No cutout) =====
  iphonese:       { n: 'iPhone SE',         w: 375, h: 667, os: 'iphone', r: 28, type: 'none',   sb: 32, dpr: 2 },

  // ===== Android =====
  galaxys25ultra: { n: 'Galaxy S25 Ultra',  w: 384, h: 832, os: 'android', r: 36, type: 'punch', sb: 48, dpr: 3 },
  galaxys25:      { n: 'Galaxy S25',        w: 360, h: 780, os: 'android', r: 32, type: 'punch', sb: 48, dpr: 3 },
  galaxys24ultra: { n: 'Galaxy S24 Ultra',  w: 384, h: 832, os: 'android', r: 36, type: 'punch', sb: 48, dpr: 3 },
  galaxys24:      { n: 'Galaxy S24',        w: 360, h: 780, os: 'android', r: 32, type: 'punch', sb: 48, dpr: 3 },
  pixel9:         { n: 'Pixel 9',           w: 412, h: 924, os: 'android', r: 36, type: 'punch', sb: 48, dpr: 2.625 },
  pixel9pro:      { n: 'Pixel 9 Pro',       w: 427, h: 952, os: 'android', r: 36, type: 'punch', sb: 48, dpr: 3 },
  pixel8:         { n: 'Pixel 8',           w: 412, h: 915, os: 'android', r: 36, type: 'punch', sb: 48, dpr: 2.625 },
  pixel8pro:      { n: 'Pixel 8 Pro',       w: 448, h: 998, os: 'android', r: 36, type: 'punch', sb: 48, dpr: 3 },

  // ===== iPad =====
  ipadmini:       { n: 'iPad mini',         w: 744, h: 1133, os: 'ipad', r: 24, type: 'none', sb: 24, dpr: 2 },
  ipadpro11:      { n: 'iPad Pro 11"',      w: 834, h: 1194, os: 'ipad', r: 18, type: 'none', sb: 24, dpr: 2 },
  ipadair:        { n: 'iPad Air',          w: 820, h: 1180, os: 'ipad', r: 18, type: 'none', sb: 24, dpr: 2 },

  // ===== Android tablets =====
  galaxytabs9:    { n: 'Galaxy Tab S9',     w: 753, h: 1205, os: 'android', form: 'tablet', r: 16, type: 'none', sb: 32, dpr: 2 },
  pixeltablet:    { n: 'Pixel Tablet',      w: 800, h: 1280, os: 'android', form: 'tablet', r: 20, type: 'none', sb: 32, dpr: 2 },

  web:            { n: 'Web',               w: 1280, h: 800, os: 'web', form: 'web', r: 16, type: 'none', sb: 0, dpr: 1 },
};

function isTabletDevice(d) {
  return !!d && (d.os === 'ipad' || d.form === 'tablet');
}

function launcherColumns(d, land) {
  if (!isTabletDevice(d)) return 4;
  if (d.os === 'ipad' && deviceKey === 'ipadmini') return land ? 6 : 5;
  return land ? 8 : 6;
}
let deviceKey = 'iphone15pro';
let osMode = 'home';

function applyWebDevice() {
  currentDevice = 'web';
  const frame = document.getElementById('phone-frame');
  const wrap = document.getElementById('phone-wrap');
  const orient = document.getElementById('orient-btn');
  frame.dataset.form = 'web';
  frame.dataset.os = 'web';
  frame.dataset.orient = 'portrait';
  frame.dataset.cutout = 'none';
  frame.style.borderRadius = '16px';
  if (orient) orient.style.display = 'none';
  const wpBtn = document.getElementById('wallpaper-btn');
  if (wpBtn) wpBtn.style.display = 'none';
  document.getElementById('resolution-display').innerText = 'Web';
  paintFrameChrome();
  fitDevice();
  osMode = 'expo';
  showOs();
}

function applyDevice() {
  const d = DEVICES[deviceKey];
  if (!d) return;
  if (d.os === 'web') {
    applyWebDevice();
    return;
  }

  const land = currentOrientation === 'landscape';
  const w = land ? d.h : d.w;
  const h = land ? d.w : d.h;

  currentDevice = d.os === 'android' ? 'android' : d.os === 'ipad' ? 'ipad' : 'iphone';
  const tablet = isTabletDevice(d);

  const frame = document.getElementById('phone-frame');
  const wrap = document.getElementById('phone-wrap');
  const notch = document.getElementById('phone-notch');
  const sb = document.getElementById('status-bar');
  const hic = document.getElementById('home-indicator-container');
  const hi = document.getElementById('home-indicator');

  frame.dataset.form = tablet ? 'tablet' : 'phone';
  frame.dataset.os = d.os;
  frame.dataset.orient = land ? 'landscape' : 'portrait';
  frame.dataset.cutout = d.type || 'none';
  const orient = document.getElementById('orient-btn');
  if (orient) orient.style.display = '';
  const wpBtn = document.getElementById('wallpaper-btn');
  if (wpBtn) wpBtn.style.display = '';
  frame.style.setProperty('--os-cols', String(launcherColumns(d, land)));

  // Frame size + radius
  frame.style.width = (w + 20) + 'px';
  frame.style.height = (h + 20) + 'px';
  frame.style.borderRadius = (d.r + 10) + 'px';

  // Reset notch element. Only the selected device's cutout is shown.
  notch.className = '';
  notch.innerHTML = '';
  notch.style.cssText = 'display:none;pointer-events:none;';

  // ===== Cutout handling (more realistic) =====
  // In landscape the physical top of the phone is the left edge, so the cutout moves there.
  const cam = '<div class="os-cam"></div>';
  if (d.type === 'island') {
    if (land) {
      notch.style.cssText = `
        display:block; pointer-events:none;
        position:absolute; left:10px; top:50%; transform:translateY(-50%);
        width:34px; height:118px; background:#000; border-radius:20px;
        z-index:60; box-shadow:0 0 0 1px rgba(255,255,255,.08) inset;
      `;
      notch.innerHTML = cam;
    } else {
      const islandH = 34;
      const islandTop = Math.max(6, Math.round((d.sb - islandH) / 2));
      notch.style.cssText = `
        display:block; pointer-events:none;
        position:absolute; top:${islandTop}px; left:50%; transform:translateX(-50%);
        width:110px; height:${islandH}px; background:#000; border-radius:20px;
        z-index:60; box-shadow:0 0 0 1px rgba(255,255,255,.08) inset;
      `;
      notch.innerHTML = cam;
    }
  } else if (d.type === 'notch') {
    if (land) {
      notch.style.cssText = `
        display:block; pointer-events:none;
        position:absolute; left:0; top:50%; transform:translateY(-50%);
        width:28px; height:146px; background:#000;
        border-top-right-radius:18px; border-bottom-right-radius:18px;
        z-index:50;
      `;
    } else {
      notch.style.cssText = `
        display:block; pointer-events:none;
        position:absolute; top:0; left:50%; transform:translateX(-50%);
        width:150px; height:30px; background:#000;
        border-bottom-left-radius:18px; border-bottom-right-radius:18px;
        z-index:50;
      `;
    }
  } else if (d.type === 'punch') {
    const hole = 14;
    if (land) {
      notch.style.cssText = `
        display:block; pointer-events:none;
        position:absolute; left:12px; top:50%; transform:translateY(-50%);
        width:${hole}px; height:${hole}px; background:#000; border-radius:50%;
        z-index:50; box-shadow:0 0 0 2px #111;
      `;
    } else {
      const holeTop = Math.max(8, Math.round((d.sb - hole) / 2));
      notch.style.cssText = `
        display:block; pointer-events:none;
        position:absolute; top:${holeTop}px; left:50%; transform:translateX(-50%);
        width:${hole}px; height:${hole}px; background:#000; border-radius:50%;
        z-index:50; box-shadow:0 0 0 2px #111;
      `;
    }
  }

  // ===== Status bar =====
  // Middle column is exactly the cutout width, so the clock and icons stay in the safe side areas.
  const cutoutW = land || d.type === 'none' ? 0 : d.type === 'island' ? 126 : d.type === 'notch' ? 168 : 36;
  const sbH = land ? Math.min(d.sb, d.os === 'android' ? 28 : 32) : d.sb;
  sb.style.display = 'grid';
  sb.style.gridTemplateColumns = '1fr ' + cutoutW + 'px 1fr';
  sb.style.alignItems = 'center';
  sb.style.height = sbH + 'px';
  sb.style.boxSizing = 'border-box';
  sb.style.paddingTop = '0px';
  sb.style.paddingBottom = '0px';
  sb.style.paddingLeft = sb.style.paddingRight = tablet ? '28px' : '16px';
  sb.style.fontSize = d.os === 'iphone' ? '15px' : '13px';

  // ===== Home indicator, classic home button, or Android navigation =====
  const nav = document.getElementById('android-nav');
  const classicHome = d.os === 'iphone' && d.type === 'none' && !land;
  const gestureHome = d.os === 'ipad' || (d.type !== 'none' && d.os === 'iphone');
  const androidNav = d.os === 'android';
  nav.style.display = androidNav ? 'flex' : 'none';
  nav.style.height = land ? '36px' : '48px';
  if (androidNav) {
    hic.style.display = 'none';
    hi.style.display = 'none';
    hi.dataset.shape = '';
  } else if (classicHome) {
    hic.style.display = 'flex';
    hic.style.height = '58px';
    hi.style.display = 'block';
    hi.style.width = '44px';
    hi.style.height = '44px';
    hi.style.borderRadius = '50%';
    hi.style.border = '2px solid rgba(0,0,0,.28)';
    hi.dataset.shape = 'button';
  } else if (gestureHome) {
    hic.style.display = 'flex';
    hic.style.height = tablet ? '28px' : '22px';
    hi.style.display = 'block';
    hi.style.width = tablet ? '180px' : '134px';
    hi.style.height = '5px';
    hi.style.borderRadius = '100px';
    hi.style.border = 'none';
    hi.dataset.shape = 'pill';
  } else {
    hic.style.display = 'none';
    hi.style.display = 'none';
    hi.dataset.shape = '';
  }

  // Resolution label
  document.getElementById('resolution-display').innerText = `${d.n} • ${w} × ${h}`;

  paintFrameChrome();
  paintOrientIcon();

  buildLauncher();
  fitDevice();
  paintStatusBar();
  if (window.__emitDimensions) window.__emitDimensions();
}
function fitDevice() {
  const frame = document.getElementById('phone-frame');
  const wrap = document.getElementById('phone-wrap');
  if (deviceKey === 'web') {
    frame.style.transform = 'none';
    frame.style.width = '100%';
    frame.style.height = '100%';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    window.__deviceScale = 1;
    return;
  }
  const area = wrap.parentElement;
  const fw = parseFloat(frame.style.width), fh = parseFloat(frame.style.height);
  const s = Math.max(0.1, Math.min(1, (area.clientWidth - 8) / fw, (area.clientHeight - 8) / fh));
  window.__deviceScale = s;
  frame.style.transform = 'scale(' + s + ')';
  wrap.style.width = fw * s + 'px';
  wrap.style.height = fh * s + 'px';
}

function setDevice(key) {
  deviceKey = DEVICES[key] ? key : 'iphone15';
  applyDevice();
  runCode(); // re-run so Platform.OS and Dimensions update
}

function paintFrameChrome() {
  const frame = document.getElementById('phone-frame');
  if (!frame) return;
  if (frame.dataset.os === 'web') {
    const dark = document.documentElement.dataset.theme === 'dark';
    frame.style.borderWidth = '1px';
    frame.style.borderColor = dark ? '#3f3f46' : '#d4d4d8';
    frame.style.boxShadow = '0 18px 50px rgba(0,0,0,.28)';
    return;
  }
  frame.style.borderWidth = '12px';
  const dark = document.documentElement.dataset.theme === 'dark';
  if (dark) {
    frame.style.borderColor = '#8d8d92';
    frame.style.boxShadow = '0 0 0 3px #d4d4d8, inset 0 0 0 2px #2c2c2e, 0 25px 60px -12px rgba(0,0,0,.55)';
  } else {
    frame.style.borderColor = '#111111';
    frame.style.boxShadow = '0 0 0 2px #000, inset 0 0 0 2px #1a1a1a, 0 25px 60px -12px rgba(0,0,0,.4)';
  }
}

function paintOrientIcon() {
  const rect = document.getElementById('orient-phone');
  const btn = document.getElementById('orient-btn');
  const land = currentOrientation === 'landscape';
  if (rect) {
    rect.setAttribute('x', land ? '1.5' : '7');
    rect.setAttribute('y', land ? '7' : '1.5');
    rect.setAttribute('width', land ? '21' : '10');
    rect.setAttribute('height', land ? '10' : '21');
  }
  if (btn) {
    const label = land ? 'Switch to portrait' : 'Switch to landscape';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
}

function toggleOrientation() {
  if (deviceKey === 'web') return;
  currentOrientation = currentOrientation === 'portrait' ? 'landscape' : 'portrait';
  applyDevice();
  setTimeout(runCode, 350);
}

document.addEventListener('suite-theme', paintFrameChrome);

function wallpaperById(id) {
  return WALLPAPERS.find((item) => item.id === id) || WALLPAPERS[0];
}

function currentWallpaper() {
  if (wallpaperId === 'custom' && customWallpaper) return customWallpaper;
  return wallpaperById(wallpaperId);
}

function rememberCustomWallpaper() {
  if (!customWallpaper) return;
  try {
    localStorage.setItem('rn-wallpaper-image', customWallpaper.url);
    localStorage.setItem('rn-wallpaper-meta', JSON.stringify({
      dark: customWallpaper.dark,
      top: customWallpaper.top,
      bottom: customWallpaper.bottom
    }));
  } catch (e) {}
}

function sampleStrip(ctx, width, y0, y1) {
  const h = Math.max(1, y1 - y0);
  const data = ctx.getImageData(0, y0, width, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(4, Math.floor(data.length / 1600) * 4);
  for (let i = 0; i < data.length; i += step) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function useWallpaperFile(file) {
  if (!file) return;
  if (file.type && file.type.indexOf('image/') !== 0) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxEdge = 1280;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const top = sampleStrip(ctx, canvas.width, 0, Math.max(1, Math.round(canvas.height * 0.14)));
      const bottom = sampleStrip(ctx, canvas.width, Math.min(canvas.height - 1, Math.round(canvas.height * 0.86)), canvas.height);
      const lum = 0.299 * top[0] + 0.587 * top[1] + 0.114 * top[2];
      const css = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      customWallpaper = {
        id: 'custom',
        url: canvas.toDataURL('image/jpeg', 0.82),
        dark: lum < 160,
        top: css(top),
        bottom: css(bottom)
      };
      rememberCustomWallpaper();
      paintCustomSwatch();
      applyWallpaper('custom');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function paintCustomSwatch() {
  const grid = document.querySelector('#wallpaper-sheet .wp-grid');
  if (!grid) return;
  let el = grid.querySelector('.wp-swatch[data-id="custom"]');
  if (!customWallpaper) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.className = 'wp-swatch';
    el.dataset.id = 'custom';
    el.title = 'Your photo';
    el.setAttribute('aria-label', 'Your photo');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      applyWallpaper('custom');
    });
    grid.appendChild(el);
  }
  el.style.backgroundImage = 'url("' + customWallpaper.url + '")';
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.classList.toggle('on', wallpaperId === 'custom');
}

function closeWallpaper() {
  const sheet = document.getElementById('wallpaper-sheet');
  if (sheet) sheet.classList.remove('on');
}

function applyWallpaper(id) {
  if (id === 'custom' && !customWallpaper) id = 'aurora';
  const wp = id === 'custom' ? customWallpaper : wallpaperById(id);
  wallpaperId = wp.id;
  const home = document.getElementById('os-home');
  const layer = document.getElementById('os-wallpaper');
  if (home) {
    home.dataset.wallpaper = wp.id;
    home.dataset.ink = wp.dark ? 'light' : 'dark';
  }
  if (layer) {
    layer.dataset.wallpaper = wp.id;
    if (wp.id === 'custom') {
      layer.style.backgroundImage = 'url("' + wp.url + '")';
      layer.style.backgroundSize = 'cover';
      layer.style.backgroundPosition = 'center';
      layer.style.backgroundRepeat = 'no-repeat';
    } else {
      layer.style.removeProperty('background-image');
      layer.style.removeProperty('background-size');
      layer.style.removeProperty('background-position');
      layer.style.removeProperty('background-repeat');
    }
  }
  try { localStorage.setItem('rn-wallpaper', wp.id); } catch (e) {}
  const sheet = document.getElementById('wallpaper-sheet');
  if (sheet) {
    sheet.querySelectorAll('.wp-swatch').forEach((el) => {
      el.classList.toggle('on', el.dataset.id === wp.id);
    });
  }
  paintStatusBar();
}

function ensureWallpaperSheet() {
  if (document.getElementById('wallpaper-sheet')) return;
  const screen = document.getElementById('emulator-screen');
  if (!screen) return;
  const sheet = document.createElement('div');
  sheet.id = 'wallpaper-sheet';
  const panel = document.createElement('div');
  panel.className = 'wp-panel';
  const title = document.createElement('div');
  title.className = 'wp-title';
  title.textContent = 'Wallpaper';
  const grid = document.createElement('div');
  grid.className = 'wp-grid';
  WALLPAPERS.forEach((wp) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wp-swatch';
    btn.dataset.id = wp.id;
    btn.title = wp.name;
    btn.setAttribute('aria-label', wp.name);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyWallpaper(wp.id);
    });
    grid.appendChild(btn);
  });
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'wp-file';
  pick.textContent = 'From your computer';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.className = 'wp-file-input';
  input.setAttribute('aria-label', 'Choose a wallpaper from your computer');
  pick.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (file) useWallpaperFile(file);
  });
  panel.append(title, pick, input, grid);
  sheet.appendChild(panel);
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) closeWallpaper();
  });
  screen.appendChild(sheet);
  paintCustomSwatch();
}

function openWallpaper() {
  if (deviceKey === 'web') return;
  const show = () => {
    if (osMode !== 'home') return;
    ensureWallpaperSheet();
    const sheet = document.getElementById('wallpaper-sheet');
    if (!sheet) return;
    sheet.classList.toggle('dark', isDarkPreview);
    paintCustomSwatch();
    sheet.querySelectorAll('.wp-swatch').forEach((el) => {
      el.classList.toggle('on', el.dataset.id === wallpaperId);
    });
    sheet.classList.add('on');
  };
  if (osMode === 'home') {
    show();
    return;
  }
  goHome();
  setTimeout(show, motionMs(320));
}

function bindWallpaper() {
  ensureWallpaperSheet();
  applyWallpaper(wallpaperId);
  const btn = document.getElementById('wallpaper-btn');
  if (btn) btn.addEventListener('click', openWallpaper);
  const home = document.getElementById('os-home');
  if (!home) return;
  let timer = 0;
  let start = null;
  home.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.os-app, button, a')) return;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = 0;
      openWallpaper();
    }, 480);
  });
  home.addEventListener('pointermove', (e) => {
    if (!timer || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy > 64) {
      clearTimeout(timer);
      timer = 0;
    }
  });
  const end = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = 0;
  };
  home.addEventListener('pointerup', end);
  home.addEventListener('pointercancel', end);
}

function applyPreviewTheme() {
  const screen = document.getElementById('emulator-screen');
  const icon = document.getElementById('theme-icon');
  const home = document.getElementById('os-home');
  const system = document.getElementById('os-system');
  if (window.rnAppearance) window.rnAppearance.set(isDarkPreview ? 'dark' : 'light');
  if (home) applyWallpaper(wallpaperId);
  if (system) system.classList.toggle('dark', isDarkPreview);
  const unsupported = document.getElementById('os-unsupported');
  if (unsupported) unsupported.classList.toggle('dark', isDarkPreview);
  const switcher = document.getElementById('app-switcher');
  if (switcher) switcher.classList.toggle('dark', isDarkPreview);
  const kbp = document.getElementById('kb-panel');
  if (kbp) kbp.classList.toggle('dark', isDarkPreview);
  if (window.__kbRerender && window.__kbOpen) window.__kbRerender();
  if (screen) {
    screen.style.backgroundColor = isDarkPreview ? '#020617' : '#ffffff';
    screen.style.color = isDarkPreview ? '#f1f5f9' : '#0f172a';
  }
  if (icon) icon.className = isDarkPreview ? 'fa-solid fa-sun text-xs text-amber-400' : 'fa-solid fa-moon text-xs';
  try { localStorage.setItem('rn-device', isDarkPreview ? 'dark' : 'light'); } catch (e) {}
  paintStatusBar();
  if (window.__examplesRerender) window.__examplesRerender();
}

function toggleTheme() {
  isDarkPreview = !isDarkPreview;
  applyPreviewTheme();
}

// ---------- Status bar that follows the app's background ----------
var sbOverride = null;
function setStatusBar(o) { sbOverride = o; paintStatusBar(); }
window.setStatusBar = setStatusBar;

function paintStatusBar() {
  const sb = document.getElementById('status-bar');
  const screen = document.getElementById('emulator-screen');
  const hic = document.getElementById('home-indicator-container');
  const hi = document.getElementById('home-indicator');
  if (!sb || !screen) return;
  const o = sbOverride || {};
  let bg = o.backgroundColor || null;
  if (!bg) {
    const first = document.getElementById('app-root').firstElementChild;
    const c = first ? getComputedStyle(first).backgroundColor : '';
    if (c && !/rgba\(.*,\s*0\)|transparent/.test(c)) bg = c;
  }
  bg = bg || screen.style.backgroundColor;
  let light;
  if (o.barStyle === 'light-content' || o.style === 'light') light = true;
  else if (o.barStyle === 'dark-content' || o.style === 'dark') light = false;
  else {
    const m = (bg.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
    light = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 140;
  }
  if (osMode === 'system') light = isDarkPreview;
  const nav = document.getElementById('android-nav');
  const themeBg = isDarkPreview ? '#020617' : '#ffffff';
  const wp = currentWallpaper();
  if (osMode === 'home' || osMode === 'switcher') {
    light = wp.dark;
    sb.style.background = 'transparent';
    sb.style.color = wp.dark ? '#ffffff' : '#0f172a';
    hic.style.background = 'transparent';
    screen.style.backgroundColor = 'transparent';
  } else if (osMode === 'system') {
    sb.style.background = isDarkPreview ? '#0f172a' : '#f2f2f7';
    sb.style.color = isDarkPreview ? '#ffffff' : '#0f172a';
    hic.style.background = isDarkPreview ? '#0f172a' : '#f2f2f7';
    screen.style.backgroundColor = themeBg;
  } else {
    sb.style.background = bg;
    sb.style.color = light ? '#ffffff' : '#0f172a';
    hic.style.background = bg;
    screen.style.backgroundColor = bg;
  }
  sb.style.border = 'none';
  screen.style.border = 'none';
  if (nav) {
    nav.style.background = (osMode === 'home' || osMode === 'switcher') ? 'transparent' : sb.style.background;
    nav.style.color = sb.style.color;
    nav.style.border = 'none';
    nav.style.boxShadow = 'none';
  }
  if (hi.dataset.shape === 'button') {
    hi.style.background = 'transparent';
    hi.style.borderColor = light ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.28)';
  } else if (hi.dataset.shape === 'pill') {
    hi.style.background = light ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)';
  }
}

// ---------- Native-looking Alert ----------
window.showNativeAlert = (title, message, buttons) => {
  console.log('[Alert] ' + title + (message ? ': ' + message : ''));
  const root = document.getElementById('modal-root');
  const ios = currentDevice !== 'android', dark = isDarkPreview;
  const btns = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  const line = 'rgba(128,128,128,.35)';
  const ov = document.createElement('div');
  ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;pointer-events:auto;animation:rn-fade .15s;z-index:5';
  const box = document.createElement('div');
  box.style.cssText = 'width:' + (ios ? 270 : 280) + 'px;background:' + (dark ? '#2c2c2e' : '#fff') + ';color:' + (dark ? '#fff' : '#111') + ';border-radius:' + (ios ? 14 : 28) + 'px;overflow:hidden;font-family:Inter,sans-serif;' + (ios ? 'text-align:center;' : 'padding:24px 24px 8px;box-shadow:0 8px 24px rgba(0,0,0,.4);');
  const head = document.createElement('div');
  head.style.cssText = ios ? 'padding:18px 16px 14px' : 'padding:0 0 16px';
  head.innerHTML = '<div style="font-weight:600;font-size:' + (ios ? 17 : 22) + 'px">' + escapeHtml(title) + '</div>' + (message ? '<div style="font-size:' + (ios ? 13 : 14) + 'px;margin-top:4px;opacity:.85">' + escapeHtml(message) + '</div>' : '');
  box.appendChild(head);
  const row = document.createElement('div');
  row.style.cssText = ios ? 'display:flex;' + (btns.length > 2 ? 'flex-direction:column;' : '') + 'border-top:1px solid ' + line : 'display:flex;justify-content:flex-end;gap:8px;padding-bottom:8px';
  btns.forEach((b, i) => {
    const el = document.createElement('div');
    el.textContent = b.text;
    const red = b.style === 'destructive', bold = b.style === 'cancel';
    el.style.cssText = ios
      ? 'flex:1;padding:12px;font-size:17px;cursor:pointer;color:' + (red ? '#ff3b30' : '#0a84ff') + ';font-weight:' + (bold ? 600 : 400) + ';' + (i > 0 ? (btns.length <= 2 ? 'border-left' : 'border-top') + ':1px solid ' + line : '')
      : 'padding:10px 12px;font-size:14px;font-weight:500;cursor:pointer;color:' + (red ? '#ef4444' : '#6750a4');
    el.onclick = () => { ov.remove(); b.onPress && b.onPress(); };
    row.appendChild(el);
  });
  box.appendChild(row);
  ov.appendChild(box);
  root.appendChild(ov);
};

window.showNativePrompt = (title, message, callbackOrButtons, defaultValue) => {
  const buttons = Array.isArray(callbackOrButtons) ? callbackOrButtons : [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', onPress: callbackOrButtons }];
  const root = document.getElementById('modal-root');
  const dark = isDarkPreview;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:6';
  const box = document.createElement('div');
  box.style.cssText = 'width:270px;background:' + (dark ? '#2c2c2e' : '#fff') + ';color:' + (dark ? '#fff' : '#111') + ';border-radius:14px;overflow:hidden;font-family:Inter,sans-serif;text-align:center';
  box.innerHTML = '<div style="padding:16px 16px 8px;font-weight:600">' + escapeHtml(title || '') + '</div>' + (message ? '<div style="padding:0 16px 8px;font-size:13px;opacity:.8">' + escapeHtml(message) + '</div>' : '');
  const input = document.createElement('input');
  input.value = defaultValue || '';
  input.style.cssText = 'margin:0 16px 12px;width:calc(100% - 32px);box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid #cbd5e1;font:14px Inter,sans-serif';
  box.appendChild(input);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;border-top:1px solid rgba(128,128,128,.35)';
  buttons.forEach((b, i) => {
    const el = document.createElement('div');
    el.textContent = b.text;
    el.style.cssText = 'flex:1;padding:12px;color:#0a84ff;cursor:pointer' + (i ? ';border-left:1px solid rgba(128,128,128,.35)' : '');
    el.onclick = () => { ov.remove(); if (b.onPress) b.onPress(input.value); else if (typeof callbackOrButtons === 'function' && b.text !== 'Cancel') callbackOrButtons(input.value); };
    row.appendChild(el);
  });
  box.appendChild(row);
  ov.appendChild(box);
  root.appendChild(ov);
  setTimeout(() => input.focus(), 30);
};

// ---------- Vibration shake ----------
window.shakePhone = () => {
  const f = document.getElementById('phone-frame');
  f.classList.remove('rn-shake'); void f.offsetWidth; f.classList.add('rn-shake');
};

// ---------- Touch simulation: finger dot, drag-to-scroll with momentum ----------
(function touchSim() {
  const frame = document.getElementById('phone-frame'), screen = document.getElementById('emulator-screen');
  const dot = document.createElement('div');
  dot.style.cssText = 'position:absolute;width:38px;height:38px;border-radius:50%;background:rgba(140,140,140,.35);border:2px solid rgba(255,255,255,.65);pointer-events:none;z-index:60;display:none;transform:translate(-50%,-50%)';
  frame.appendChild(dot);
  const scale = () => window.__deviceScale || 1;
  const pos = (e) => { const r = frame.getBoundingClientRect(); dot.style.left = ((e.clientX - r.left) / scale()) + 'px'; dot.style.top = ((e.clientY - r.top) / scale()) + 'px'; };
  const scrollable = (el) => {
    while (el && el !== frame) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return { el, axis: 'y' };
      if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) return { el, axis: 'x' };
      el = el.parentElement;
    }
    return null;
  };
  let drag = null, suppress = false;
  frame.addEventListener('mousedown', (e) => {
    if (e.button) return;
    dot.style.display = 'block'; pos(e);
    const field = /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    const selectable = e.target.closest && e.target.closest('pre.ex-code');
    if (screen.contains(e.target) && !field && !selectable) drag = { sc: scrollable(e.target), x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, v: 0 };
  });
  window.addEventListener('mousemove', (e) => {
    if (dot.style.display === 'none') return;
    pos(e);
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) { drag.moved = true; getSelection().removeAllRanges(); }
    if (drag.moved && drag.sc) {
      const dx = (e.clientX - drag.lx) / scale(), dy = (e.clientY - drag.ly) / scale();
      if (drag.sc.axis === 'y') { drag.sc.el.scrollTop -= dy; drag.v = -dy; } else { drag.sc.el.scrollLeft -= dx; drag.v = -dx; }
    }
    drag.lx = e.clientX; drag.ly = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    dot.style.display = 'none';
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    suppress = true; setTimeout(() => { suppress = false; }, 0);
    if (d.sc) {
      let v = d.v;
      const f = () => { v *= 0.95; if (Math.abs(v) < 0.3) return; if (d.sc.axis === 'y') d.sc.el.scrollTop += v; else d.sc.el.scrollLeft += v; requestAnimationFrame(f); };
      f();
    }
  });
  frame.addEventListener('click', (e) => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
})();

// ---------- Phone launcher (Expo-style home screen) ----------
const LAUNCHER = [
  { id: 'expo', name: 'React Native', bg: '#09090b', fg: '#61dafb', icon: 'fa-brands fa-react', kind: 'expo' },
  { id: 'examples', name: 'Examples', bg: '#4f46e5', fg: '#ffffff', icon: 'fa-solid fa-flask', kind: 'examples' },
];

let launchOrigin = null;

function launcherButton(app) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'os-app' + (app.kind === 'expo' ? ' expo' : '');
  button.innerHTML = '<span class="os-icon" style="background:' + app.bg + ';color:' + app.fg + '"><i class="' + app.icon + '"></i></span><span>' + app.name + '</span>';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const icon = button.querySelector('.os-icon');
    const screen = document.getElementById('emulator-screen');
    if (icon && screen) {
      const ir = icon.getBoundingClientRect();
      const sr = screen.getBoundingClientRect();
      launchOrigin = {
        x: ((ir.left + ir.width / 2) - sr.left) / sr.width * 100,
        y: ((ir.top + ir.height / 2) - sr.top) / sr.height * 100
      };
    }
    openApp(app);
  });
  return button;
}

function buildLauncher() {
  const home = document.getElementById('os-home');
  if (!home) return;
  const d = DEVICES[deviceKey] || {};
  const tablet = isTabletDevice(d);
  home.dataset.shell = !tablet ? 'phone' : d.os === 'ipad' ? 'ipad' : 'android';
  home.innerHTML = '';
  const clock = document.createElement('div');
  clock.className = 'os-clock';
  clock.innerHTML = '<div class="os-clock-time" id="os-home-clock"></div><div class="os-clock-date" id="os-home-date"></div>';
  const dock = document.createElement('div');
  dock.className = 'os-shelf';
  LAUNCHER.forEach((app) => dock.appendChild(launcherButton(app)));
  home.append(clock, dock);
  paintClock();
}

let recents = [];
let screenGen = 0;
let homeTap = 0;

function motionMs(ms) {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
}

function remember(id) {
  const at = recents.indexOf(id);
  if (at >= 0) recents.splice(at, 1);
  recents.unshift(id);
}

function showOs() {
  const home = document.getElementById('os-home');
  const system = document.getElementById('os-system');
  const app = document.getElementById('app-root');
  const blocked = document.getElementById('os-unsupported');
  const sw = document.getElementById('app-switcher');
  if (!home || !system || !app) return;
  const mode = osMode;
  home.style.display = (mode === 'home' || mode === 'switcher') ? 'flex' : 'none';
  system.style.display = mode === 'system' ? 'flex' : 'none';
  app.style.display = mode === 'expo' ? 'flex' : 'none';
  if (blocked) blocked.style.display = mode === 'unsupported' ? 'flex' : 'none';
  if (sw) sw.style.display = mode === 'switcher' ? 'flex' : 'none';
  const frame = document.getElementById('phone-frame');
  if (frame) frame.dataset.screen = mode;
  if (mode !== 'home') closeWallpaper();
  paintStatusBar();
  if (mode !== 'expo' && mode !== 'system' && window.__kbHide) window.__kbHide();
}

function enterLayer(el) {
  if (!el) return;
  el.classList.remove('rn-app-out', 'rn-app-out-icon', 'rn-app-in', 'rn-app-in-center', 'rn-app-in-android');
  const fromIcon = !!(launchOrigin && currentDevice !== 'android');
  if (fromIcon) {
    el.style.transformOrigin = launchOrigin.x + '% ' + launchOrigin.y + '%';
    el.dataset.originX = String(launchOrigin.x);
    el.dataset.originY = String(launchOrigin.y);
  } else if (currentDevice !== 'android') {
    el.style.transformOrigin = '50% 50%';
  }
  launchOrigin = null;
  const kind = currentDevice === 'android' ? 'rn-app-in-android' : (fromIcon ? 'rn-app-in' : 'rn-app-in-center');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add(kind);
      setTimeout(() => el.classList.remove(kind), motionMs(460));
    });
  });
}

function revealApp(mode) {
  const token = ++screenGen;
  osMode = mode;
  showOs();
  const home = document.getElementById('os-home');
  const layer = mode === 'expo' ? document.getElementById('app-root')
    : mode === 'system' ? document.getElementById('os-system')
    : document.getElementById('os-unsupported');
  if (home && deviceKey !== 'web') home.style.display = 'flex';
  enterLayer(layer);
  setTimeout(() => {
    if (token !== screenGen) return;
    if (osMode === 'home' || osMode === 'switcher') return;
    if (home) home.style.display = 'none';
  }, motionMs(440));
}

function goHome() {
  if (deviceKey === 'web') return;
  if (osMode === 'home') return;
  const token = ++screenGen;
  const layer = osMode === 'expo' ? document.getElementById('app-root')
    : osMode === 'system' ? document.getElementById('os-system')
    : osMode === 'unsupported' ? document.getElementById('os-unsupported')
    : null;
  if (!layer || osMode === 'switcher') {
    osMode = 'home';
    showOs();
    return;
  }
  document.getElementById('os-home').style.display = 'flex';
  layer.classList.remove('rn-app-in', 'rn-app-in-center', 'rn-app-in-android');
  const backToIcon = layer.dataset.originX && currentDevice !== 'android';
  if (backToIcon) layer.style.transformOrigin = layer.dataset.originX + '% ' + layer.dataset.originY + '%';
  const outClass = backToIcon ? 'rn-app-out-icon' : 'rn-app-out';
  layer.classList.add(outClass);
  setTimeout(() => {
    layer.classList.remove(outClass);
    if (token !== screenGen) return;
    osMode = 'home';
    showOs();
  }, motionMs(280));
}

function goBack() {
  if (osMode === 'switcher') { goHome(); return; }
  if (window.__rnBack && window.__rnBack()) return;
  if (window.__examplesBack && window.__examplesBack()) return;
  if (osMode !== 'home') goHome();
}

function openExpo() {
  remember('expo');
  const root = document.getElementById('app-root');
  const empty = !root || !root.firstElementChild;
  revealApp('expo');
  if (empty && window.runCode) window.runCode();
}

function openExamples() {
  remember('examples');
  revealApp('system');
  if (window.renderExamples) window.renderExamples();
}

function showUnsupported(app) {
  const host = document.getElementById('os-unsupported');
  if (!host) return;
  host.innerHTML = '<div class="os-unsup">'
    + '<div class="os-unsup-icon" style="background:' + app.bg + ';color:' + app.fg + '"><i class="' + app.icon + '"></i></div>'
    + '<div class="os-unsup-name">' + escapeHtml(app.name) + '</div>'
    + '<p>' + escapeHtml(app.name) + ' is not supported in this emulator yet.</p>'
    + '<p class="os-unsup-sub">React Native and Examples are the only apps you can open.</p>'
    + '<button type="button" class="os-unsup-btn">Go Home</button>'
    + '</div>';
  host.querySelector('.os-unsup-btn').addEventListener('click', goHome);
  revealApp('unsupported');
}

function openApp(app) {
  if (app.kind === 'expo') { openExpo(); return; }
  if (app.kind === 'examples') { openExamples(); return; }
  showUnsupported(app);
}

function renderSwitcher() {
  const sw = document.getElementById('app-switcher');
  if (!sw) return;
  const android = currentDevice === 'android';
  sw.classList.toggle('android', android);
  if (!recents.length) {
    sw.innerHTML = '<div class="rn-switcher-empty"><b>No recent apps</b><span>Open React Native or Examples, then come back here to close them.</span></div>';
    return;
  }
  const cards = recents.map((id) => {
    const app = LAUNCHER.find((item) => item.id === id);
    if (!app) return '';
    return '<article class="rn-card" data-app="' + id + '">'
      + '<div class="rn-card-head">'
      + '<i class="' + app.icon + '" style="background:' + app.bg + ';color:' + app.fg + '"></i>'
      + '<span>' + escapeHtml(app.name) + '</span>'
      + '<button type="button" class="rn-card-x" title="Close ' + escapeHtml(app.name) + '" aria-label="Close ' + escapeHtml(app.name) + '">×</button>'
      + '</div>'
      + '<div class="rn-card-body"><i class="' + app.icon + '"></i></div>'
      + '</article>';
  }).join('');
  sw.innerHTML = '<div class="rn-switcher-title">' + (android ? 'Recent apps' : '') + '</div>'
    + '<div class="rn-switcher-cards">' + cards + '</div>'
    + '<div class="rn-switcher-hint">Swipe a card up, or tap ×, to close it</div>';
  sw.querySelectorAll('.rn-card').forEach((card) => {
    const id = card.getAttribute('data-app');
    let startY = 0;
    let dragY = 0;
    let dragging = false;
    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.rn-card-x')) return;
      dragging = true;
      startY = e.clientY;
      dragY = 0;
      card.setPointerCapture(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const scale = window.__deviceScale || 1;
      dragY = Math.min(0, (e.clientY - startY) / scale);
      card.style.transform = 'translateY(' + dragY + 'px)';
    });
    card.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      if (dragY < -70) {
        card.classList.add('rn-card-away');
        setTimeout(() => killRecent(id), motionMs(200));
      } else if (dragY > -12) {
        card.style.transform = '';
        resumeRecent(id);
      } else {
        card.style.transform = '';
      }
    });
    card.addEventListener('pointercancel', () => { dragging = false; card.style.transform = ''; });
    card.querySelector('.rn-card-x').addEventListener('click', (e) => {
      e.stopPropagation();
      card.classList.add('rn-card-away');
      setTimeout(() => killRecent(id), motionMs(200));
    });
  });
}

function resumeRecent(id) {
  if (id === 'expo') openExpo();
  else if (id === 'examples') openExamples();
}

function killRecent(id) {
  recents = recents.filter((item) => item !== id);
  if (id === 'examples' && window.__examplesLeave) window.__examplesLeave();
  if (id === 'expo') {
    const modal = document.getElementById('modal-root');
    if (modal) modal.innerHTML = '';
    if (window.__rnUnmount) window.__rnUnmount();
  }
  if (osMode === 'switcher') renderSwitcher();
}

function openSwitcher() {
  if (deviceKey === 'web') return;
  ++screenGen;
  renderSwitcher();
  osMode = 'switcher';
  showOs();
  const sw = document.getElementById('app-switcher');
  if (sw) {
    sw.classList.remove('rn-switcher-in');
    void sw.offsetWidth;
    sw.classList.add('rn-switcher-in');
  }
}

function pressHome() {
  const now = Date.now();
  if (now - homeTap < 320) {
    homeTap = 0;
    openSwitcher();
    return;
  }
  homeTap = now;
  goHome();
}

function restartEmulator() {
  ++screenGen;
  recents = [];
  if (window.__examplesLeave) window.__examplesLeave();
  if (window.__kbHide) window.__kbHide();
  const modal = document.getElementById('modal-root');
  if (modal) modal.innerHTML = '';
  if (window.__rnUnmount) window.__rnUnmount();
  const blocked = document.getElementById('os-unsupported');
  if (blocked) blocked.innerHTML = '';
  const boot = document.getElementById('emulator-boot');
  if (boot) boot.classList.add('on');
  osMode = 'home';
  showOs();
  setTimeout(() => {
    if (boot) boot.classList.remove('on');
    if (deviceKey === 'web') {
      osMode = 'expo';
      showOs();
      if (window.runCode) window.runCode(true);
    } else if (window.runCode) {
      window.runCode();
    }
  }, 700);
}

window.goHome = goHome;
window.goBack = goBack;
window.openExpo = openExpo;
window.openSwitcher = openSwitcher;
window.restartEmulator = restartEmulator;
window.openApp = openApp;

(function bindChrome() {
  const homeBar = document.getElementById('home-indicator-container');
  const toolbarHome = document.getElementById('toolbar-home');
  const androidHome = document.getElementById('android-home');
  const androidBack = document.getElementById('android-back');
  const androidRecent = document.getElementById('android-recent');
  const restart = document.getElementById('restart-emulator');
  const webReload = document.getElementById('web-reload');
  if (homeBar) homeBar.addEventListener('click', pressHome);
  if (toolbarHome) toolbarHome.addEventListener('click', pressHome);
  if (androidHome) androidHome.addEventListener('click', pressHome);
  if (androidBack) androidBack.addEventListener('click', goBack);
  if (androidRecent) androidRecent.addEventListener('click', () => { if (osMode === 'switcher') goHome(); else openSwitcher(); });
  if (restart) restart.addEventListener('click', restartEmulator);
  if (webReload) webReload.addEventListener('click', () => { if (window.runCode) window.runCode(true); });
  const sw = document.getElementById('app-switcher');
  if (sw) sw.addEventListener('click', (e) => {
    if (osMode !== 'switcher') return;
    if (e.target.closest('.rn-card')) return;
    goHome();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const sheet = document.getElementById('wallpaper-sheet');
    if (sheet && sheet.classList.contains('on')) {
      closeWallpaper();
      return;
    }
    if (osMode === 'switcher') goHome();
  });
})();

function paintBattery(level, charging) {
  const icon = document.getElementById('battery-icon');
  const bolt = document.getElementById('battery-bolt');
  const wrap = document.getElementById('battery-wrap');
  if (!icon || !bolt || !wrap) return;
  const name = level < 0.15 ? 'fa-battery-empty'
    : level < 0.4 ? 'fa-battery-quarter'
    : level < 0.65 ? 'fa-battery-half'
    : level < 0.9 ? 'fa-battery-three-quarters'
    : 'fa-battery-full';
  icon.className = 'fa-solid ' + name;
  bolt.classList.toggle('on', !!charging);
  wrap.title = (charging ? 'Charging · ' : '') + Math.round(level * 100) + '%';
}

function watchBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then((battery) => {
    const paint = () => paintBattery(battery.level, battery.charging);
    paint();
    battery.addEventListener('chargingchange', paint);
    battery.addEventListener('levelchange', paint);
  }).catch(() => {});
}

function paintClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const status = document.getElementById('status-time');
  if (status) status.textContent = time;
  const homeTime = document.getElementById('os-home-clock');
  const homeDate = document.getElementById('os-home-date');
  if (homeTime) homeTime.textContent = time;
  if (homeDate) homeDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

setInterval(paintStatusBar, 800);

buildLauncher();
watchBattery();
const picked = document.getElementById('device-select');
if (picked && DEVICES[picked.value]) deviceKey = picked.value;
applyDevice();
applyPreviewTheme();
bindWallpaper();
showOs();
new ResizeObserver(fitDevice).observe(document.getElementById('phone-wrap').parentElement);

setInterval(paintClock, 1000);
paintClock();
