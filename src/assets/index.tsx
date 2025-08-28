import React from 'react';
import FeatherIcon from 'react-native-vector-icons/Feather';
import IoniconsIcon from 'react-native-vector-icons/Ionicons';
import ZocialIcon from 'react-native-vector-icons/Zocial';
import EntypoIcon from 'react-native-vector-icons/Entypo';
import FontistoIcon from 'react-native-vector-icons/Fontisto';
import EvilIconsIcon from 'react-native-vector-icons/EvilIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import AntDesignIcon from 'react-native-vector-icons/AntDesign';
import OcticonsIcon from 'react-native-vector-icons/Octicons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import FoundationIcon from 'react-native-vector-icons/Foundation';
import MaterialIconsIcon from 'react-native-vector-icons/MaterialIcons';
import SimpleLineIconsIcon from 'react-native-vector-icons/SimpleLineIcons';
import MaterialCommunityIconsIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesome6Icon from 'react-native-vector-icons/FontAwesome6';
import { ViewStyle } from 'react-native';

export type IconType =
  | 'fontistoIcon'
  | 'materialIcon'
  | 'evilIcon'
  | 'featherIcon'
  | 'antDesignIcon'
  | 'simpleLineIcon'
  | 'zocialIcon'
  | 'foundationIcon'
  | 'fontAwesome5Icon'
  | 'fontAwesome6Icon'
  | 'fontAwesomeIcon'
  | 'ioniconsIcon'
  | 'materialCommunityIcon'
  | 'entypoIcon'
  | 'OcticonsIcon';

const getIcon = (type: IconType) => {
  switch (type) {
    case 'fontistoIcon':
      return FontistoIcon;
    case 'materialIcon':
      return MaterialIconsIcon;
    case 'evilIcon':
      return EvilIconsIcon;
    case 'featherIcon':
      return FeatherIcon;
    case 'antDesignIcon':
      return AntDesignIcon;
    case 'fontAwesome6Icon':
      return FontAwesome6Icon;
    case 'simpleLineIcon':
      return SimpleLineIconsIcon;
    case 'zocialIcon':
      return ZocialIcon;
    case 'foundationIcon':
      return FoundationIcon;
    case 'fontAwesome5Icon':
      return FontAwesome5Icon;
    case 'fontAwesomeIcon':
      return FontAwesomeIcon;
    case 'ioniconsIcon':
      return IoniconsIcon;
    case 'materialCommunityIcon':
      return MaterialCommunityIconsIcon;
    case 'entypoIcon':
      return EntypoIcon;
    case 'OcticonsIcon':
      return OcticonsIcon;
    default:
      return FontAwesomeIcon;
  }
};

type Props = {
  type: IconType;
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
};

const Icon = ({ type, ...props }: Props) => {
  const FontIcon = getIcon(type);

  return <FontIcon {...props} />;
};

export default Icon;
