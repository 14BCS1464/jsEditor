// Examples app: catalog of supported React Native APIs, each with a snippet and a live preview.
(function () {
  const React = window.React;
  const h = React.createElement;
  let root = null;
  let bump = null;

  const theme = () => {
    const dark = document.getElementById('os-system').classList.contains('dark');
    return dark
      ? { bg: '#0f172a', card: '#1e293b', text: '#f8fafc', muted: '#94a3b8', accent: '#38bdf8' }
      : { bg: '#f2f2f7', card: '#ffffff', text: '#0f172a', muted: '#64748b', accent: '#0284c7' };
  };

  const RN = () => window.RNComponents;

  function DemoTouchable() {
    const [n, setN] = React.useState(0);
    const { TouchableOpacity, Text } = RN();
    return h(TouchableOpacity, {
      onPress: () => setN(n + 1),
      style: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' }
    }, h(Text, { style: { color: '#fff', fontWeight: '600' } }, 'Pressed ' + n + ' times'));
  }

  function DemoPressable() {
    const { Pressable, Text } = RN();
    return h(Pressable, {
      onPress: () => {},
      style: ({ pressed }) => ({ backgroundColor: pressed ? '#0369a1' : '#0ea5e9', padding: 12, borderRadius: 10, alignItems: 'center' })
    }, ({ pressed }) => h(Text, { style: { color: '#fff' } }, pressed ? 'Holding' : 'Press and hold'));
  }

  function DemoHighlight() {
    const { TouchableHighlight, Text } = RN();
    return h(TouchableHighlight, {
      underlayColor: '#bae6fd',
      onPress: () => {},
      style: { padding: 12, borderRadius: 10, backgroundColor: '#e0f2fe' }
    }, h(Text, { style: { color: '#0c4a6e', textAlign: 'center' } }, 'Highlight on press'));
  }

  function DemoView() {
    const { View, Text } = RN();
    return h(View, { style: { flexDirection: 'row', gap: 8 } },
      h(View, { style: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#0284c7' } }),
      h(View, { style: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' } },
        h(Text, { style: { color: '#fff', fontSize: 12 } }, 'View')));
  }

  function DemoText() {
    const { Text } = RN();
    return h(Text, { style: { fontSize: 16, lineHeight: 22 } },
      'Plain text, ',
      h(Text, { style: { fontWeight: '700', color: '#0284c7' } }, 'nested text'),
      ', and a line that truncates when it gets too long for the screen.',
    );
  }

  function DemoImage() {
    const { Image } = RN();
    return h(Image, {
      source: { uri: 'https://picsum.photos/id/1015/400/240' },
      resizeMode: 'cover',
      style: { width: '100%', height: 140, borderRadius: 12 }
    });
  }

  function DemoInput() {
    const [value, setValue] = React.useState('');
    const { TextInput, Text } = RN();
    return h(React.Fragment, null,
      h(TextInput, { value, onChangeText: setValue, placeholder: 'Type here', style: { borderColor: '#cbd5e1' } }),
      h(Text, { style: { marginTop: 8, color: '#334155' } }, value ? 'You typed: ' + value : 'The field is empty'));
  }

  function DemoSwitch() {
    const [on, setOn] = React.useState(false);
    const { View, Text, Switch } = RN();
    return h(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } },
      h(Text, null, on ? 'On' : 'Off'),
      h(Switch, { value: on, onValueChange: setOn }));
  }

  function DemoButton() {
    const [label, setLabel] = React.useState('Tap the button');
    const { Button, Text } = RN();
    return h(React.Fragment, null,
      h(Button, { title: 'Button', onPress: () => setLabel('Button pressed') }),
      h(Text, { style: { marginTop: 8 } }, label));
  }

  function DemoScroll() {
    const { ScrollView, Text, View } = RN();
    const colors = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#e11d48'];
    return h(ScrollView, { horizontal: true, style: { height: 72 }, showsHorizontalScrollIndicator: false },
      colors.map((color) => h(View, { key: color, style: { width: 72, height: 64, borderRadius: 12, backgroundColor: color, marginRight: 8, alignItems: 'center', justifyContent: 'center' } },
        h(Text, { style: { color: '#fff', fontSize: 11 } }, 'Card'))));
  }

  function DemoFlatList() {
    const { FlatList, Text, View } = RN();
    const data = ['Apple', 'Mango', 'Banana', 'Peach'];
    return h(FlatList, {
      data,
      keyExtractor: (item) => item,
      numColumns: 2,
      style: { maxHeight: 120 },
      renderItem: ({ item }) => h(View, { style: { width: '50%', padding: 4 } },
        h(Text, { style: { backgroundColor: '#e0f2fe', borderRadius: 8, padding: 8, color: '#0c4a6e' } }, item))
    });
  }

  function DemoSectionList() {
    const { SectionList, Text } = RN();
    return h(SectionList, {
      style: { maxHeight: 160 },
      sections: [
        { title: 'Fruit', data: ['Apple', 'Mango'] },
        { title: 'Color', data: ['Blue', 'Red'] }
      ],
      keyExtractor: (item) => item,
      renderSectionHeader: ({ section }) => h(Text, { style: { fontWeight: '700', marginTop: 6 } }, section.title),
      renderItem: ({ item }) => h(Text, { style: { paddingVertical: 4, paddingLeft: 8 } }, item)
    });
  }

  function DemoActivity() {
    const { View, ActivityIndicator, Text } = RN();
    return h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 12 } },
      h(ActivityIndicator, { color: '#0284c7' }),
      h(ActivityIndicator, { size: 'large', color: '#7c3aed' }),
      h(Text, null, 'Loading'));
  }

  function DemoModal() {
    const [open, setOpen] = React.useState(false);
    const { Modal, View, Text, Pressable } = RN();
    return h(React.Fragment, null,
      h(Pressable, { onPress: () => setOpen(true), style: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' } },
        h(Text, { style: { color: '#fff' } }, 'Open modal')),
      h(Modal, { visible: open, transparent: true, animationType: 'fade', onRequestClose: () => setOpen(false) },
        h(View, { style: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' } },
          h(View, { style: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%' } },
            h(Text, { style: { fontWeight: '700', marginBottom: 8, color: '#0f172a' } }, 'Modal'),
            h(Text, { style: { color: '#334155', marginBottom: 12 } }, 'This sits above the screen.'),
            h(Pressable, { onPress: () => setOpen(false) }, h(Text, { style: { color: '#0284c7' } }, 'Close'))))));
  }

  function DemoStatusBar() {
    const { View, Pressable, Text, StatusBar } = RN();
    const set = (style) => StatusBar.setBarStyle(style);
    return h(View, { style: { flexDirection: 'row', gap: 8 } },
      h(Pressable, { onPress: () => set('light-content'), style: { flex: 1, backgroundColor: '#0f172a', padding: 10, borderRadius: 8, alignItems: 'center' } },
        h(Text, { style: { color: '#fff', fontSize: 12 } }, 'Light icons')),
      h(Pressable, { onPress: () => set('dark-content'), style: { flex: 1, backgroundColor: '#e2e8f0', padding: 10, borderRadius: 8, alignItems: 'center' } },
        h(Text, { style: { color: '#0f172a', fontSize: 12 } }, 'Dark icons')));
  }

  function DemoKeyboardAvoid() {
    const { KeyboardAvoidingView, TextInput, Text } = RN();
    return h(KeyboardAvoidingView, { behavior: 'padding' },
      h(Text, { style: { marginBottom: 8, color: '#334155' } }, 'Focus the field. The keyboard slides in.'),
      h(TextInput, { placeholder: 'Name', style: { borderColor: '#cbd5e1' } }));
  }

  function DemoRefresh() {
    const [refreshing, setRefreshing] = React.useState(false);
    const [items, setItems] = React.useState(['Pull down to refresh']);
    const { FlatList, Text } = RN();
    const onRefresh = () => {
      setRefreshing(true);
      setTimeout(() => {
        setItems((list) => ['Updated ' + (list.length + 1), ...list].slice(0, 4));
        setRefreshing(false);
      }, 700);
    };
    return h(FlatList, {
      data: items,
      refreshing,
      onRefresh,
      style: { maxHeight: 120 },
      keyExtractor: (item, index) => item + index,
      renderItem: ({ item }) => h(Text, { style: { paddingVertical: 6 } }, item)
    });
  }

  function DemoAlert() {
    const { Pressable, Text, Alert } = RN();
    return h(Pressable, {
      onPress: () => Alert.alert('Hello', 'This alert is drawn by the phone.', [{ text: 'OK' }]),
      style: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' }
    }, h(Text, { style: { color: '#fff' } }, 'Show alert'));
  }

  function DemoPrompt() {
    const [value, setValue] = React.useState('No answer yet');
    const { Pressable, Text, Alert } = RN();
    return h(React.Fragment, null,
      h(Pressable, {
        onPress: () => Alert.prompt('Your name', 'Used only in this example.', (name) => setValue(name || 'empty')),
        style: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' }
      }, h(Text, { style: { color: '#fff' } }, 'Ask for a name')),
      h(Text, { style: { marginTop: 8 } }, value));
  }

  function DemoSheet() {
    const [value, setValue] = React.useState('Nothing picked');
    const { Pressable, Text, ActionSheetIOS } = RN();
    return h(React.Fragment, null,
      h(Pressable, {
        onPress: () => ActionSheetIOS.showActionSheetWithOptions({
          title: 'Choose',
          options: ['Photo', 'Camera', 'Cancel'],
          cancelButtonIndex: 2
        }, (index) => setValue(['Photo', 'Camera', 'Cancel'][index])),
        style: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, alignItems: 'center' }
      }, h(Text, { style: { color: '#fff' } }, 'Open action sheet')),
      h(Text, { style: { marginTop: 8 } }, value));
  }

  function DemoToast() {
    const { Pressable, Text, ToastAndroid } = RN();
    return h(Pressable, {
      onPress: () => ToastAndroid.show('Saved', ToastAndroid.SHORT),
      style: { backgroundColor: '#059669', padding: 12, borderRadius: 10, alignItems: 'center' }
    }, h(Text, { style: { color: '#fff' } }, 'Show toast'));
  }

  function DemoShare() {
    const [value, setValue] = React.useState('Ready');
    const { Pressable, Text, Share } = RN();
    return h(React.Fragment, null,
      h(Pressable, {
        onPress: () => Share.share({ message: 'Hello from the Examples app' }).then((res) => setValue(res.action)),
        style: { backgroundColor: '#7c3aed', padding: 12, borderRadius: 10, alignItems: 'center' }
      }, h(Text, { style: { color: '#fff' } }, 'Share')),
      h(Text, { style: { marginTop: 8 } }, value));
  }

  function DemoVibrate() {
    const { Pressable, Text, Vibration } = RN();
    return h(Pressable, {
      onPress: () => Vibration.vibrate(80),
      style: { backgroundColor: '#e11d48', padding: 12, borderRadius: 10, alignItems: 'center' }
    }, h(Text, { style: { color: '#fff' } }, 'Vibrate'));
  }

  function DemoAnimated() {
    const { Animated, Pressable, Text, View } = RN();
    const x = React.useRef(new Animated.Value(0)).current;
    const run = () => {
      x.setValue(0);
      Animated.timing(x, { toValue: 1, duration: 700, useNativeDriver: false }).start();
    };
    return h(View, null,
      h(Animated.View, {
        style: {
          width: 44, height: 44, borderRadius: 12, backgroundColor: '#0284c7', marginBottom: 12,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 140] }) }]
        }
      }),
      h(Pressable, { onPress: run, style: { backgroundColor: '#0f172a', padding: 10, borderRadius: 8, alignItems: 'center' } },
        h(Text, { style: { color: '#fff' } }, 'Run timing')));
  }

  function DemoEasing() {
    const { Animated, Easing, Pressable, Text } = RN();
    const y = React.useRef(new Animated.Value(0)).current;
    const run = () => {
      y.setValue(0);
      Animated.timing(y, { toValue: 1, duration: 900, easing: Easing.bounce, useNativeDriver: false }).start();
    };
    return h(React.Fragment, null,
      h(Animated.View, {
        style: {
          width: 36, height: 36, borderRadius: 18, backgroundColor: '#d97706', marginBottom: 12,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) }]
        }
      }),
      h(Pressable, { onPress: run, style: { backgroundColor: '#d97706', padding: 10, borderRadius: 8, alignItems: 'center' } },
        h(Text, { style: { color: '#fff' } }, 'Bounce')));
  }

  function DemoPan() {
    const { PanResponder, View, Text } = RN();
    const [pos, setPos] = React.useState({ x: 0, y: 0 });
    const pan = React.useRef(PanResponder.create({
      onPanResponderMove: (e, g) => setPos({ x: g.dx, y: g.dy }),
      onPanResponderRelease: () => setPos({ x: 0, y: 0 })
    })).current;
    return h(React.Fragment, null,
      h(Text, { style: { marginBottom: 8, color: '#334155' } }, 'Drag the square'),
      h(View, {
        ...pan.panHandlers,
        style: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#7c3aed', transform: [{ translateX: pos.x }, { translateY: pos.y }] }
      }));
  }

  function DemoLayout() {
    const [wide, setWide] = React.useState(false);
    const { LayoutAnimation, Pressable, Text, View } = RN();
    const toggle = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setWide(!wide);
    };
    return h(React.Fragment, null,
      h(View, { style: { height: 36, width: wide ? '100%' : 80, borderRadius: 8, backgroundColor: '#059669', marginBottom: 12 } }),
      h(Pressable, { onPress: toggle, style: { backgroundColor: '#059669', padding: 10, borderRadius: 8, alignItems: 'center' } },
        h(Text, { style: { color: '#fff' } }, 'Animate layout')));
  }

  function DemoStyleSheet() {
    const { StyleSheet, View, Text } = RN();
    const styles = StyleSheet.create({
      card: { padding: 12, borderRadius: 12, backgroundColor: '#fef3c7' },
      title: { fontWeight: '700', color: '#92400e' }
    });
    return h(View, { style: styles.card }, h(Text, { style: styles.title }, 'StyleSheet.create'));
  }

  function DemoPlatform() {
    const { Platform, Text } = RN();
    return h(Text, { style: { lineHeight: 22 } },
      'OS ' + Platform.OS + '\nVersion ' + Platform.Version + '\nisPad ' + String(Platform.isPad));
  }

  function DemoDimensions() {
    const { useWindowDimensions, Text } = RN();
    const size = useWindowDimensions();
    return h(Text, null, Math.round(size.width) + ' × ' + Math.round(size.height));
  }

  function DemoScheme() {
    const { useColorScheme, Text } = RN();
    return h(Text, null, 'Color scheme: ' + useColorScheme());
  }

  function DemoAppearance() {
    const { Appearance, Text } = RN();
    return h(Text, null, 'Appearance.getColorScheme() → ' + Appearance.getColorScheme());
  }

  function DemoClipboard() {
    const [value, setValue] = React.useState('Nothing copied');
    const { Pressable, Text, Clipboard } = RN();
    return h(React.Fragment, null,
      h(Pressable, {
        onPress: async () => {
          Clipboard.setString('Hello from Examples');
          const read = await Clipboard.getString();
          setValue(read || 'Copied Hello from Examples');
        },
        style: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' }
      }, h(Text, { style: { color: '#fff' } }, 'Copy a string')),
      h(Text, { style: { marginTop: 8 } }, value));
  }

  function DemoLinking() {
    const [value, setValue] = React.useState('Not checked');
    const { Pressable, Text, Linking } = RN();
    return h(React.Fragment, null,
      h(Pressable, {
        onPress: async () => setValue(String(await Linking.canOpenURL('https://reactnative.dev'))),
        style: { backgroundColor: '#0284c7', padding: 12, borderRadius: 10, alignItems: 'center' }
      }, h(Text, { style: { color: '#fff' } }, 'canOpenURL')),
      h(Text, { style: { marginTop: 8 } }, 'Result: ' + value));
  }

  function DemoKeyboard() {
    const [visible, setVisible] = React.useState(false);
    const { Keyboard, TextInput, Text } = RN();
    React.useEffect(() => {
      const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
      const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
      return () => { show.remove(); hide.remove(); };
    }, []);
    return h(React.Fragment, null,
      h(TextInput, { placeholder: 'Focus me', style: { borderColor: '#cbd5e1' } }),
      h(Text, { style: { marginTop: 8 } }, visible ? 'Keyboard is visible' : 'Keyboard is hidden'));
  }

  function DemoKeyboardType() {
    const { View, Text, TextInput } = RN();
    const fields = [
      ['default', 'sentences', 'done', 'Default'],
      ['email-address', 'none', 'go', 'Email'],
      ['url', 'none', 'go', 'URL'],
      ['twitter', 'none', 'send', 'Twitter'],
      ['web-search', 'sentences', 'search', 'Search'],
      ['numeric', 'none', 'done', 'Numeric'],
      ['number-pad', 'none', 'done', 'Number pad'],
      ['decimal-pad', 'none', 'done', 'Decimal pad'],
      ['phone-pad', 'none', 'done', 'Phone pad'],
      ['name-phone-pad', 'words', 'done', 'Name / phone']
    ];
    return h(View, { style: { gap: 8 } }, fields.map(([type, cap, ret, label]) => h(View, { key: type },
      h(Text, { style: { fontSize: 11, color: '#64748b', marginBottom: 3 } }, label + ' · ' + type),
      h(TextInput, {
        keyboardType: type,
        autoCapitalize: cap,
        returnKeyType: ret,
        placeholder: label,
        style: { borderColor: '#cbd5e1', paddingVertical: 8 }
      }))));
  }

  function DemoAppState() {
    const { AppState, Text } = RN();
    return h(Text, null, 'AppState.currentState → ' + AppState.currentState);
  }

  function DemoPixel() {
    const { PixelRatio, Text } = RN();
    return h(Text, { style: { lineHeight: 22 } },
      'PixelRatio ' + PixelRatio.get() + '\nfont scale ' + PixelRatio.getFontScale());
  }

  function DemoPermission() {
    const [value, setValue] = React.useState('Not requested');
    const { Pressable, Text, PermissionsAndroid } = RN();
    return h(React.Fragment, null,
      h(Pressable, {
        onPress: async () => setValue(await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)),
        style: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, alignItems: 'center' }
      }, h(Text, { style: { color: '#fff' } }, 'Request camera')),
      h(Text, { style: { marginTop: 8 } }, value));
  }

  function DemoBack() {
    const [value, setValue] = React.useState('Handler is not installed');
    const { Pressable, Text, BackHandler, View } = RN();
    React.useEffect(() => () => {}, []);
    const arm = () => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setValue('Back was handled');
        sub.remove();
        return true;
      });
      setValue('Now press the device Back control');
    };
    return h(View, null,
      h(Pressable, { onPress: arm, style: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, alignItems: 'center' } },
        h(Text, { style: { color: '#fff' } }, 'Listen for back')),
      h(Text, { style: { marginTop: 8 } }, value));
  }

  const CATALOG = [
    { id: 'view', group: 'Components', name: 'View', blurb: 'The box everything else sits in.', Demo: DemoView, code:
`<View style={{ flexDirection: 'row', gap: 8 }}>
  <View style={{ flex: 1, height: 48, backgroundColor: '#0284c7' }} />
  <View style={{ flex: 1, height: 48, backgroundColor: '#7c3aed' }} />
</View>` },
    { id: 'text', group: 'Components', name: 'Text', blurb: 'Nested text and font styles.', Demo: DemoText, code:
`<Text>
  Plain text,{' '}
  <Text style={{ fontWeight: '700', color: '#0284c7' }}>nested text</Text>
</Text>` },
    { id: 'image', group: 'Components', name: 'Image', blurb: 'Draws a picture from source.uri.', Demo: DemoImage, code:
`<Image
  source={{ uri: 'https://picsum.photos/id/1015/400/240' }}
  resizeMode="cover"
  style={{ width: '100%', height: 140, borderRadius: 12 }}
/>` },
    { id: 'textinput', group: 'Components', name: 'TextInput', blurb: 'A controlled text field.', Demo: DemoInput, code:
`const [value, setValue] = useState('');

<TextInput
  value={value}
  onChangeText={setValue}
  placeholder="Type here"
/>` },
    { id: 'switch', group: 'Components', name: 'Switch', blurb: 'An on and off control.', Demo: DemoSwitch, code:
`<Switch value={on} onValueChange={setOn} />` },
    { id: 'button', group: 'Components', name: 'Button', blurb: 'A basic labeled button.', Demo: DemoButton, code:
`<Button title="Button" onPress={() => console.log('pressed')} />` },
    { id: 'pressable', group: 'Components', name: 'Pressable', blurb: 'Style and children can follow the press.', Demo: DemoPressable, code:
`<Pressable
  onPress={onPress}
  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
>
  {({ pressed }) => <Text>{pressed ? 'Holding' : 'Press'}</Text>}
</Pressable>` },
    { id: 'touchable', group: 'Components', name: 'TouchableOpacity', blurb: 'Fades while your finger is down.', Demo: DemoTouchable, code:
`<TouchableOpacity
  activeOpacity={0.7}
  onPress={() => console.log('pressed')}
  style={{ padding: 12, backgroundColor: '#0284c7', borderRadius: 10 }}
>
  <Text style={{ color: '#fff' }}>Press me</Text>
</TouchableOpacity>` },
    { id: 'highlight', group: 'Components', name: 'TouchableHighlight', blurb: 'Shows an underlay color while pressed.', Demo: DemoHighlight, code:
`<TouchableHighlight underlayColor="#bae6fd" onPress={onPress}>
  <Text>Highlight on press</Text>
</TouchableHighlight>` },
    { id: 'scroll', group: 'Components', name: 'ScrollView', blurb: 'Scrolls content that is bigger than the screen.', Demo: DemoScroll, code:
`<ScrollView horizontal>
  <View style={{ width: 72, height: 64 }} />
</ScrollView>` },
    { id: 'activity', group: 'Components', name: 'ActivityIndicator', blurb: 'A spinning progress marker.', Demo: DemoActivity, code:
`<ActivityIndicator size="large" color="#0284c7" />` },
    { id: 'modal', group: 'Components', name: 'Modal', blurb: 'A dialog that covers the screen.', Demo: DemoModal, code:
`const [open, setOpen] = useState(false);

<Pressable onPress={() => setOpen(true)}>
  <Text>Open modal</Text>
</Pressable>

<Modal
  visible={open}
  transparent
  animationType="fade"
  onRequestClose={() => setOpen(false)}
>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '80%' }}>
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>Modal</Text>
      <Text style={{ marginBottom: 12 }}>This sits above the screen.</Text>
      <Pressable onPress={() => setOpen(false)}>
        <Text style={{ color: '#0284c7' }}>Close</Text>
      </Pressable>
    </View>
  </View>
</Modal>` },
    { id: 'statusbar', group: 'Components', name: 'StatusBar', blurb: 'Light or dark icons in the status bar.', Demo: DemoStatusBar, code:
`<StatusBar barStyle="light-content" />
StatusBar.setBarStyle('dark-content')` },
    { id: 'kav', group: 'Components', name: 'KeyboardAvoidingView', blurb: 'Keeps a field above the keyboard.', Demo: DemoKeyboardAvoid, code:
`<KeyboardAvoidingView behavior="padding">
  <TextInput placeholder="Name" />
</KeyboardAvoidingView>` },
    { id: 'refresh', group: 'Lists', name: 'RefreshControl', blurb: 'Pull to refresh a list.', Demo: DemoRefresh, code:
`<FlatList
  data={items}
  refreshing={refreshing}
  onRefresh={onRefresh}
  renderItem={({ item }) => <Text>{item}</Text>}
/>` },
    { id: 'flatlist', group: 'Lists', name: 'FlatList', blurb: 'Renders a list, including columns.', Demo: DemoFlatList, code:
`<FlatList
  data={['Apple', 'Mango']}
  numColumns={2}
  keyExtractor={(item) => item}
  renderItem={({ item }) => <Text>{item}</Text>}
/>` },
    { id: 'section', group: 'Lists', name: 'SectionList', blurb: 'A list split into titled sections.', Demo: DemoSectionList, code:
`<SectionList
  sections={[{ title: 'Fruit', data: ['Apple'] }]}
  renderSectionHeader={({ section }) => <Text>{section.title}</Text>}
  renderItem={({ item }) => <Text>{item}</Text>}
/>` },
    { id: 'alert', group: 'Feedback', name: 'Alert', blurb: 'A native alert dialog.', Demo: DemoAlert, code:
`Alert.alert('Hello', 'Saved to the phone.', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK' },
])` },
    { id: 'prompt', group: 'Feedback', name: 'Alert.prompt', blurb: 'An alert with a text field.', Demo: DemoPrompt, code:
`Alert.prompt('Your name', 'Shown in the example.', (name) => {
  console.log(name);
})` },
    { id: 'sheet', group: 'Feedback', name: 'ActionSheetIOS', blurb: 'A sheet of choices.', Demo: DemoSheet, code:
`ActionSheetIOS.showActionSheetWithOptions({
  options: ['Photo', 'Camera', 'Cancel'],
  cancelButtonIndex: 2,
}, (index) => console.log(index))` },
    { id: 'toast', group: 'Feedback', name: 'ToastAndroid', blurb: 'A short message at the bottom.', Demo: DemoToast, code:
`ToastAndroid.show('Saved', ToastAndroid.SHORT)` },
    { id: 'share', group: 'Feedback', name: 'Share', blurb: 'Sends text to the share sheet.', Demo: DemoShare, code:
`await Share.share({ message: 'Hello from the app' })` },
    { id: 'vibration', group: 'Feedback', name: 'Vibration', blurb: 'Shakes the device.', Demo: DemoVibrate, code:
`Vibration.vibrate(80)` },
    { id: 'animated', group: 'Animation', name: 'Animated', blurb: 'timing() moves a view.', Demo: DemoAnimated, code:
`const x = useRef(new Animated.Value(0)).current;

Animated.timing(x, {
  toValue: 1,
  duration: 700,
  useNativeDriver: false,
}).start();

<Animated.View style={{
  transform: [{ translateX: x.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140],
  }) }],
}} />` },
    { id: 'easing', group: 'Animation', name: 'Easing', blurb: 'Changes the curve of an animation.', Demo: DemoEasing, code:
`Animated.timing(value, {
  toValue: 1,
  duration: 900,
  easing: Easing.bounce,
  useNativeDriver: false,
}).start()` },
    { id: 'pan', group: 'Animation', name: 'PanResponder', blurb: 'Follows a finger drag.', Demo: DemoPan, code:
`const pan = PanResponder.create({
  onPanResponderMove: (e, gesture) => {
    setPos({ x: gesture.dx, y: gesture.dy });
  },
});

<View {...pan.panHandlers} />` },
    { id: 'layout', group: 'Animation', name: 'LayoutAnimation', blurb: 'Animates the next layout change.', Demo: DemoLayout, code:
`LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
setWide((value) => !value);` },
    { id: 'stylesheet', group: 'Device', name: 'StyleSheet', blurb: 'Named styles for components.', Demo: DemoStyleSheet, code:
`const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, backgroundColor: '#fef3c7' },
});` },
    { id: 'platform', group: 'Device', name: 'Platform', blurb: 'Which OS and version is selected.', Demo: DemoPlatform, code:
`Platform.OS        // 'ios' or 'android'
Platform.Version
Platform.isPad
Platform.select({ ios: 12, android: 8 })` },
    { id: 'dimensions', group: 'Device', name: 'useWindowDimensions', blurb: 'Width and height of the screen.', Demo: DemoDimensions, code:
`const { width, height } = useWindowDimensions();` },
    { id: 'scheme', group: 'Device', name: 'useColorScheme', blurb: 'Light or dark, as a hook.', Demo: DemoScheme, code:
`const scheme = useColorScheme(); // 'light' | 'dark'` },
    { id: 'appearance', group: 'Device', name: 'Appearance', blurb: 'Read the current color scheme.', Demo: DemoAppearance, code:
`Appearance.getColorScheme()` },
    { id: 'clipboard', group: 'Device', name: 'Clipboard', blurb: 'Copy and read a string.', Demo: DemoClipboard, code:
`Clipboard.setString('Hello');
const text = await Clipboard.getString();` },
    { id: 'linking', group: 'Device', name: 'Linking', blurb: 'Checks whether a URL can be opened.', Demo: DemoLinking, code:
`const ok = await Linking.canOpenURL('https://reactnative.dev');
await Linking.openURL('https://reactnative.dev');` },
    { id: 'keyboard-type', group: 'Components', name: 'keyboardType', blurb: 'Email, URL, number, phone, and search keyboards.', Demo: DemoKeyboardType, code:
`<TextInput keyboardType="email-address" autoCapitalize="none" placeholder="Email" />
<TextInput keyboardType="phone-pad" placeholder="Phone" />
<TextInput keyboardType="number-pad" placeholder="PIN" />
<TextInput keyboardType="decimal-pad" placeholder="Price" />
<TextInput keyboardType="numeric" placeholder="Amount" />
<TextInput keyboardType="url" autoCapitalize="none" placeholder="Website" />
<TextInput keyboardType="web-search" returnKeyType="search" placeholder="Search" />` },
    { id: 'keyboard', group: 'Device', name: 'Keyboard', blurb: 'Events for the on-screen keyboard.', Demo: DemoKeyboard, code:
`const sub = Keyboard.addListener('keyboardDidShow', () => {
  console.log('open');
});
// later: sub.remove()` },
    { id: 'appstate', group: 'Device', name: 'AppState', blurb: 'Whether the app is active.', Demo: DemoAppState, code:
`AppState.currentState // 'active' or 'background'` },
    { id: 'pixel', group: 'Device', name: 'PixelRatio', blurb: 'Screen density of the selected device.', Demo: DemoPixel, code:
`PixelRatio.get()
PixelRatio.roundToNearestPixel(12.4)` },
    { id: 'permissions', group: 'Device', name: 'PermissionsAndroid', blurb: 'Request a permission result.', Demo: DemoPermission, code:
`const result = await PermissionsAndroid.request(
  PermissionsAndroid.PERMISSIONS.CAMERA
);` },
    { id: 'back', group: 'Device', name: 'BackHandler', blurb: 'Handle the Android back press.', Demo: DemoBack, code:
`const sub = BackHandler.addEventListener('hardwareBackPress', () => {
  // return true to keep the screen open
  return true;
});` },
  ];

  const GROUPS = ['Components', 'Lists', 'Feedback', 'Animation', 'Device'];

  function ExamplesApp() {
    const [id, setId] = React.useState(null);
    const [query, setQuery] = React.useState('');
    const [copied, setCopied] = React.useState(false);
    const [, setTick] = React.useState(0);
    const idRef = React.useRef(null);
    idRef.current = id;
    React.useEffect(() => {
      window.__examplesBack = () => {
        if (!idRef.current) return false;
        setId(null);
        if (window.__kbHide) window.__kbHide();
        return true;
      };
      bump = () => setTick((n) => n + 1);
      return () => {
        window.__examplesBack = null;
        bump = null;
      };
    }, []);

    const t = theme();
    const { View, Text, Pressable, ScrollView, TextInput } = RN();
    const item = CATALOG.find((entry) => entry.id === id);
    const copyCode = () => {
      if (!item) return;
      const value = item.code.trim();
      const mark = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      };
      const fallback = () => {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.appendChild(area);
        area.focus();
        area.select();
        try { document.execCommand('copy'); } catch (err) {}
        area.remove();
        mark();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(mark).catch(fallback);
      } else fallback();
    };

    if (item) {
      return h(View, { style: { flex: 1, backgroundColor: t.bg } },
        h(View, { style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 } },
          h(Pressable, { onPress: () => setId(null), style: { padding: 8 } },
            h(Text, { style: { color: t.accent, fontSize: 16 } }, '‹ Examples')),
          h(Text, { style: { color: t.text, fontWeight: '700', fontSize: 16, marginLeft: 4 } }, item.name)),
        h(ScrollView, { style: { flex: 1 }, contentContainerStyle: { padding: 16, paddingTop: 8 } },
          h(View, { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 } },
            h(Text, { style: { color: t.muted, fontSize: 12 } }, 'Sample'),
            h(Pressable, {
              onPress: copyCode,
              style: { backgroundColor: copied ? '#059669' : t.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }
            }, h(Text, { style: { color: copied ? '#fff' : t.accent, fontSize: 12, fontWeight: '700' } }, copied ? 'Copied' : 'Copy'))),
          h('pre', {
            className: 'ex-code',
            style: {
              margin: 0, padding: 12, borderRadius: 12, backgroundColor: '#0f172a', color: '#e2e8f0',
              fontSize: 11, lineHeight: '16px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'pre-wrap', overflow: 'auto', userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text'
            }
          }, item.code.trim()),
          h(Text, { style: { color: t.muted, fontSize: 12, marginTop: 16, marginBottom: 8 } }, 'Preview'),
          h(View, { style: { backgroundColor: '#ffffff', color: '#0f172a', borderRadius: 12, padding: 12 } },
            h(item.Demo))));
    }

    const q = query.trim().toLowerCase();
    const shown = CATALOG.filter((entry) => !q || entry.name.toLowerCase().indexOf(q) !== -1 || entry.group.toLowerCase().indexOf(q) !== -1);
    return h(View, { style: { flex: 1, backgroundColor: t.bg } },
      h(Text, { style: { color: t.text, fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12 } }, 'Examples'),
      h(Text, { style: { color: t.muted, fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 } }, 'Tap an API to see a sample and how it behaves.'),
      h(View, { style: { paddingHorizontal: 16, paddingBottom: 8 } },
        h(TextInput, { value: query, onChangeText: setQuery, placeholder: 'Search APIs', style: { borderColor: '#cbd5e1', backgroundColor: t.card, color: t.text } })),
      h(ScrollView, { style: { flex: 1 }, contentContainerStyle: { paddingHorizontal: 16, paddingBottom: 24 } },
        shown.length ? GROUPS.map((group) => {
          const rows = shown.filter((entry) => entry.group === group);
          if (!rows.length) return null;
          return h(View, { key: group },
            h(Text, { style: { color: t.muted, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 } }, group.toUpperCase()),
            rows.map((entry) => h(Pressable, {
              key: entry.id,
              onPress: () => setId(entry.id),
              style: { backgroundColor: t.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 }
            },
              h(Text, { style: { color: t.text, fontWeight: '600', fontSize: 16 } }, entry.name),
              h(Text, { style: { color: t.muted, fontSize: 12, marginTop: 2 } }, entry.blurb))));
        }) : h(Text, { style: { color: t.muted, paddingTop: 12 } }, 'No API matches that search.')));
  }

  function renderExamples() {
    const host = document.getElementById('os-system');
    if (!host) return;
    if (!root) root = ReactDOM.createRoot(host);
    root.render(h(ExamplesApp));
  }

  window.renderExamples = renderExamples;
  window.__examplesRerender = () => { if (bump) bump(); };
  window.__examplesLeave = () => {
    if (window.__kbHide) window.__kbHide();
    window.__examplesBack = null;
    bump = null;
    if (root) {
      root.unmount();
      root = null;
    }
    const host = document.getElementById('os-system');
    if (host) host.innerHTML = '';
  };
})();
