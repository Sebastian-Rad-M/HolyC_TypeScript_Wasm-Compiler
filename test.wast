(module
 (type $0 (func))
 (type $1 (func (param i64)))
 (type $2 (func (param i64 i64 i64 i64)))
 (type $3 (func (param i32)))
 (type $4 (func (param i64 i64)))
 (type $5 (func (param i64 i64 i64)))
 (type $6 (func (param i64 i64 i64 i64 i64)))
 (type $7 (func (param i64 i64 i64) (result i64)))
 (type $8 (func (result i32)))
 (import "env" "Print0" (func $Print0 (param i64)))
 (import "env" "Print1" (func $Print1 (param i64 i64)))
 (import "env" "Print2" (func $Print2 (param i64 i64 i64)))
 (import "env" "Print3" (func $Print3 (param i64 i64 i64 i64)))
 (import "env" "Print4" (func $Print4 (param i64 i64 i64 i64 i64)))
 (import "env" "GrLine" (func $GrLine (param i64 i64 i64 i64)))
 (import "env" "Yield" (func $Yield))
 (import "env" "Sleep" (func $Sleep (param i64)))
 (import "env" "Spawn" (func $Spawn (param i64 i64 i64) (result i64)))
 (global $heap_ptr (mut i32) (i32.const 131072))
 (global $__vararg_ptr (mut i32) (i32.const 196608))
 (global $__asyncify_state (mut i32) (i32.const 0))
 (global $__asyncify_data (mut i32) (i32.const 0))
 (memory $0 10 256)
 (data $0 (i32.const 65536) "--- Test 9: Switch Statements & Ranges ---\n\00")
 (data $1 (i32.const 65580) "PASS: Switch statements and range parsing working.\n\00")
 (data $2 (i32.const 65632) "FAIL: Switch statement branching or bounds checking broken.\n\00")
 (export "memory" (memory $0))
 (export "Test9_SwitchRanges" (func $Test9_SwitchRanges))
 (export "_start" (func $_start))
 (export "asyncify_start_unwind" (func $asyncify_start_unwind))
 (export "asyncify_stop_unwind" (func $asyncify_stop_unwind))
 (export "asyncify_start_rewind" (func $asyncify_start_rewind))
 (export "asyncify_stop_rewind" (func $asyncify_stop_rewind))
 (export "asyncify_get_state" (func $asyncify_get_state))
 (func $Test9_SwitchRanges
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i64)
  (if
   (i32.eq
    (global.get $__asyncify_state)
    (i32.const 2)
   )
   (then
    (i32.store
     (global.get $__asyncify_data)
     (i32.sub
      (i32.load
       (global.get $__asyncify_data)
      )
      (i32.const 8)
     )
    )
    (local.set $2
     (i32.load
      (local.tee $0
       (i32.load
        (global.get $__asyncify_data)
       )
      )
     )
    )
    (local.set $0
     (i32.load offset=4
      (local.get $0)
     )
    )
   )
  )
  (local.set $1
   (block $__asyncify_unwind (result i32)
    (if
     (i32.eq
      (global.get $__asyncify_state)
      (i32.const 2)
     )
     (then
      (i32.store
       (global.get $__asyncify_data)
       (i32.sub
        (i32.load
         (global.get $__asyncify_data)
        )
        (i32.const 4)
       )
      )
      (local.set $1
       (i32.load
        (i32.load
         (global.get $__asyncify_data)
        )
       )
      )
     )
    )
    (if
     (i32.or
      (i32.eqz
       (global.get $__asyncify_state)
      )
      (i32.eqz
       (local.get $1)
      )
     )
     (then
      (call $Print0
       (i64.const 65536)
      )
      (drop
       (br_if $__asyncify_unwind
        (i32.const 0)
        (i32.eq
         (global.get $__asyncify_state)
         (i32.const 1)
        )
       )
      )
     )
    )
    (if
     (i32.eqz
      (global.get $__asyncify_state)
     )
     (then
      (local.set $3
       (i64.const 7)
      )
      (block $switch_vhyurn
       (block $case_usk01h
        (block $case_jvdth
         (block
          (br_if $case_jvdth
           (i64.ge_u
            (local.get $3)
            (i64.const 6)
           )
          )
          (br $case_usk01h)
         )
        )
        (br $switch_vhyurn)
       )
      )
      (local.set $2
       (i32.const 1)
      )
     )
    )
    (if
     (i32.or
      (local.tee $0
       (select
        (local.get $0)
        (local.get $2)
        (global.get $__asyncify_state)
       )
      )
      (i32.eq
       (global.get $__asyncify_state)
       (i32.const 2)
      )
     )
     (then
      (if
       (i32.or
        (i32.eqz
         (global.get $__asyncify_state)
        )
        (i32.eq
         (local.get $1)
         (i32.const 1)
        )
       )
       (then
        (call $Print0
         (i64.const 65580)
        )
        (drop
         (br_if $__asyncify_unwind
          (i32.const 1)
          (i32.eq
           (global.get $__asyncify_state)
           (i32.const 1)
          )
         )
        )
       )
      )
     )
    )
    (if
     (i32.or
      (i32.eqz
       (local.get $0)
      )
      (i32.eq
       (global.get $__asyncify_state)
       (i32.const 2)
      )
     )
     (then
      (if
       (i32.or
        (i32.eqz
         (global.get $__asyncify_state)
        )
        (i32.eq
         (local.get $1)
         (i32.const 2)
        )
       )
       (then
        (call $Print0
         (i64.const 65632)
        )
        (drop
         (br_if $__asyncify_unwind
          (i32.const 2)
          (i32.eq
           (global.get $__asyncify_state)
           (i32.const 1)
          )
         )
        )
       )
      )
     )
    )
    (return)
   )
  )
  (i32.store
   (i32.load
    (global.get $__asyncify_data)
   )
   (local.get $1)
  )
  (i32.store
   (global.get $__asyncify_data)
   (i32.add
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.const 4)
   )
  )
  (i32.store
   (local.tee $1
    (i32.load
     (global.get $__asyncify_data)
    )
   )
   (local.get $2)
  )
  (i32.store offset=4
   (local.get $1)
   (local.get $0)
  )
  (i32.store
   (global.get $__asyncify_data)
   (i32.add
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.const 8)
   )
  )
 )
 (func $_start
  (local $0 i32)
  (local.set $0
   (block $__asyncify_unwind (result i32)
    (if
     (i32.or
      (i32.eqz
       (global.get $__asyncify_state)
      )
      (i32.eqz
       (if (result i32)
        (i32.eq
         (global.get $__asyncify_state)
         (i32.const 2)
        )
        (then
         (i32.store
          (global.get $__asyncify_data)
          (i32.sub
           (i32.load
            (global.get $__asyncify_data)
           )
           (i32.const 4)
          )
         )
         (i32.load
          (i32.load
           (global.get $__asyncify_data)
          )
         )
        )
        (else
         (local.get $0)
        )
       )
      )
     )
     (then
      (call $Test9_SwitchRanges)
      (drop
       (br_if $__asyncify_unwind
        (i32.const 0)
        (i32.eq
         (global.get $__asyncify_state)
         (i32.const 1)
        )
       )
      )
     )
    )
    (return)
   )
  )
  (i32.store
   (i32.load
    (global.get $__asyncify_data)
   )
   (local.get $0)
  )
  (i32.store
   (global.get $__asyncify_data)
   (i32.add
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.const 4)
   )
  )
 )
 (func $asyncify_start_unwind (param $0 i32)
  (global.set $__asyncify_state
   (i32.const 1)
  )
  (global.set $__asyncify_data
   (local.get $0)
  )
  (if
   (i32.gt_u
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.load offset=4
     (global.get $__asyncify_data)
    )
   )
   (then
    (unreachable)
   )
  )
 )
 (func $asyncify_stop_unwind
  (global.set $__asyncify_state
   (i32.const 0)
  )
  (if
   (i32.gt_u
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.load offset=4
     (global.get $__asyncify_data)
    )
   )
   (then
    (unreachable)
   )
  )
 )
 (func $asyncify_start_rewind (param $0 i32)
  (global.set $__asyncify_state
   (i32.const 2)
  )
  (global.set $__asyncify_data
   (local.get $0)
  )
  (if
   (i32.gt_u
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.load offset=4
     (global.get $__asyncify_data)
    )
   )
   (then
    (unreachable)
   )
  )
 )
 (func $asyncify_stop_rewind
  (global.set $__asyncify_state
   (i32.const 0)
  )
  (if
   (i32.gt_u
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.load offset=4
     (global.get $__asyncify_data)
    )
   )
   (then
    (unreachable)
   )
  )
 )
 (func $asyncify_get_state (result i32)
  (global.get $__asyncify_state)
 )
)
