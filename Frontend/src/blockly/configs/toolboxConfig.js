// 使用 JSON 格式的工具箱配置
export const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  scrollbars: false,
  contents: [
    {
      kind: 'category',
      name: '引擎',
      colour: '#5631E4',
      contents: [
        { kind: 'block', type: 'engine_move' },
        { kind: 'block', type: 'engine_rotateX' },
        { kind: 'block', type: 'engine_rotateY' },
        { kind: 'block', type: 'engine_face' },
        { kind: 'block', type: 'engine_moveto' },
        { kind: 'block', type: 'engine_movetoXYZ' },
        { kind: 'block', type: 'engine_movetoXYZtime' },
        { kind: 'block', type: 'engine_Xset' },
        { kind: 'block', type: 'engine_Yset' },
        { kind: 'block', type: 'engine_Zset' },
        { kind: 'block', type: 'engine_Xadd' },
        { kind: 'block', type: 'engine_Yadd' },
        { kind: 'block', type: 'engine_Zadd' },
        { kind: 'block', type: 'engine_X' },
        { kind: 'block', type: 'engine_Y' },
        { kind: 'block', type: 'engine_Z' }
      ]
    },
    {
      kind: 'category',
      name: '外观',
      colour: '#C501F6',
      contents: [
        { kind: 'block', type: 'appearance_cartoonSet' },
        { kind: 'block', type: 'appearance_nextCartoon' },
        { kind: 'block', type: 'appearance_playCartoon' },
        { kind: 'block', type: 'appearance_stopCartoon' },
        { kind: 'block', type: 'appearance_resetCartoon'},
        { kind: 'block', type: 'appearance_sizeAdd'},
        { kind: 'block', type: 'appearance_sizeSet'},
        { kind: 'block', type: 'appearance_show'},
        { kind: 'block', type: 'appearance_hide'},
        { kind: 'block', type: 'appearance_cartoon'},
        { kind: 'block', type: 'appearance_size'}
      ]
    },
    {
      kind: 'category',
      name: '事件',
      colour: '#FFDE59',
      contents: [
        { kind: 'block', type: 'event_gameStart'},
        { kind: 'bkock', type: 'event_keyboard'},
        { kind: 'bkock', type: 'event_RB'},
        { kind: 'bkock', type: 'event_broadcast'},
        { kind: 'bkock', type: 'event_broadcastWait'}

      ]
    },
    {
      kind: 'category',
      name: '控制',
      colour: '#FE9900',
      contents: [
        { kind: 'block', type: 'control_wait'},
        { kind: 'bkock', type: 'control_for'},
        { kind: 'bkock', type: 'control_forX'},
        { kind: 'bkock', type: 'control_if'},
        { kind: 'bkock', type: 'control_else'},
        { kind: 'bkock', type: 'control_wait2'},
        { kind: 'bkock', type: 'control_until'},
        { kind: 'bkock', type: 'control_stop'},
        { kind: 'bkock', type: 'control_cloneStart'},
        { kind: 'bkock', type: 'control_clone'},
        { kind: 'bkock', type: 'control_cloneDEL'},
        { kind: 'bkock', type: 'control_senceSet'},
        { kind: 'bkock', type: 'control_nextSence'},
      ]
    },
    {
      kind: 'category',
      name: '侦测',
      colour: '#42EEF4',
      contents: [
        { kind: 'block', type: 'detect_touch'},
        { kind: 'block', type: 'detect_distance'},
        { kind: 'block', type: 'detect_ask'},
        { kind: 'block', type: 'detect_keyboard1'},
        { kind: 'block', type: 'detect_keyboard0'},
        { kind: 'block', type: 'detect_mouse1'},
        { kind: 'block', type: 'detect_mouse0'},
        { kind: 'block', type: 'detect_attribute'}
      ]
    },
    {
      kind: 'category',
      name: '运算',
      colour: '#7DDA58',
      contents: [
        { kind: 'block', type: 'math_add' },
        { kind: 'block', type: 'math_mul' },
        { kind: 'block', type: 'math_div' },
        { kind: 'block', type: 'math_sub' },
        { kind: 'block', type: 'math_random' },
        { kind: 'block', type: 'math_G' },
        { kind: 'block', type: 'math_L' },
        { kind: 'block', type: 'math_E' },
        { kind: 'block', type: 'math_AND' },
        { kind: 'block', type: 'math_OR' },
        { kind: 'block', type: 'math_NOT' },
        { kind: 'block', type: 'math_connect' }/* ,
        { kind: 'block', type: 'math_str' },
        { kind: 'block', type: 'math_strNumber' },
        { kind: 'block', type: 'math_strInside' },
        { kind: 'block', type: 'math_mod' },
        { kind: 'block', type: 'math_other' } */
      ]
    },
    {
      kind: 'category',
      name: '变量',
      colour: '#FE9900',
      contents: [
        { kind: 'block', type: 'variable_add' },
        { kind: 'block', type: 'variable_set' },
        { kind: 'block', type: 'variable_show' },
        { kind: 'block', type: 'variable_hide' }
      ]
    },
    {
      kind: 'category',
      name: '列表',
      colour: '#E4080A',
      contents: [
       /*  { kind: 'block', type: 'list_add' },
        { kind: 'block', type: 'list_del' },
        { kind: 'block', type: 'list_delAll'},
        { kind: 'block', type: 'list_insert'},
        { kind: 'block', type: 'list_override' },
        { kind: 'block', type: 'list_list' },
        { kind: 'block', type: 'list_fristSer'},
        { kind: 'block', type: 'list_number'},
        { kind: 'block', type: 'list_incode' }, */
        { kind: 'block', type: 'list_show'},
        { kind: 'block', type: 'list_hide'}
      ]
    }
  ]
};