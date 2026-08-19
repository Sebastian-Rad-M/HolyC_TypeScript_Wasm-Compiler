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
 (global $spawn_counter (mut i64) (i64.const 0))
 (global $__vararg_ptr (mut i32) (i32.const 196608))
 (global $__asyncify_state (mut i32) (i32.const 0))
 (global $__asyncify_data (mut i32) (i32.const 0))
 (memory $0 10 256)
 (data $0 (i32.const 65536) "--- Test 13: Task Management & Yield ---\n\00")
 (data $1 (i32.const 65578) "TestTask\00")
 (data $2 (i32.const 65587) "PASS: Task spawned and cooperative Yield maintained context.\n\00")
 (data $3 (i32.const 65649) "FAIL: Task scheduler failed or context corruption occurred.\n\00")
 (table $0 2 2 funcref)
 (elem $0 (i32.const 0) $__null_func $SpawnedTest)
 (export "memory" (memory $0))
 (export "SpawnedTest" (func $SpawnedTest))
 (export "Test13_Tasks" (func $Test13_Tasks))
 (export "_start" (func $_start))
 (export "table" (table $0))
 (export "asyncify_start_unwind" (func $asyncify_start_unwind))
 (export "asyncify_stop_unwind" (func $asyncify_stop_unwind))
 (export "asyncify_start_rewind" (func $asyncify_start_rewind))
 (export "asyncify_stop_rewind" (func $asyncify_stop_rewind))
 (export "asyncify_get_state" (func $asyncify_get_state))
 (func $SpawnedTest (param $0 i64)
  (local $1 i64)
  (local $2 i32)
  (local $3 i32)
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
      (i32.const 16)
     )
    )
    (local.set $0
     (i64.load align=4
      (local.tee $2
       (i32.load
        (global.get $__asyncify_data)
       )
      )
     )
    )
    (local.set $1
     (i64.load offset=8 align=4
      (local.get $2)
     )
    )
   )
  )
  (local.set $2
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
      (local.set $3
       (i32.load
        (i32.load
         (global.get $__asyncify_data)
        )
       )
      )
     )
    )
    (local.set $1
     (select
      (local.get $1)
      (i64.const 0)
      (global.get $__asyncify_state)
     )
    )
    (loop $loop_8773
     (block $block_9681
      (if
       (i32.eqz
        (global.get $__asyncify_state)
       )
       (then
        (br_if $block_9681
         (i64.ge_s
          (local.get $1)
          (i64.const 5)
         )
        )
        (global.set $spawn_counter
         (i64.add
          (global.get $spawn_counter)
          (local.get $0)
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
         (local.get $3)
        )
       )
       (then
        (call $Yield)
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
        (local.set $1
         (i64.add
          (local.get $1)
          (i64.const 1)
         )
        )
        (br $loop_8773)
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
   (local.get $2)
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
  (i64.store align=4
   (local.tee $2
    (i32.load
     (global.get $__asyncify_data)
    )
   )
   (local.get $0)
  )
  (i64.store offset=8 align=4
   (local.get $2)
   (local.get $1)
  )
  (i32.store
   (global.get $__asyncify_data)
   (i32.add
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.const 16)
   )
  )
 )
 (func $Test13_Tasks
  (local $0 i32)
  (local $1 i32)
  (local $2 i64)
  (local $3 i32)
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
      (i32.const 16)
     )
    )
    (local.set $2
     (i64.load align=4
      (local.tee $1
       (i32.load
        (global.get $__asyncify_data)
       )
      )
     )
    )
    (local.set $3
     (i32.load offset=8
      (local.get $1)
     )
    )
    (local.set $1
     (i32.load offset=12
      (local.get $1)
     )
    )
   )
  )
  (local.set $0
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
      (local.set $0
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
       (local.get $0)
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
      (global.set $spawn_counter
       (i64.const 0)
      )
     )
    )
    (if
     (i32.or
      (i32.eqz
       (global.get $__asyncify_state)
      )
      (i32.eq
       (local.get $0)
       (i32.const 1)
      )
     )
     (then
      (drop
       (call $Spawn
        (i64.const 1)
        (i64.const 10)
        (i64.const 65578)
       )
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
    (local.set $2
     (select
      (local.get $2)
      (i64.const 0)
      (global.get $__asyncify_state)
     )
    )
    (loop $loop_2139
     (block $block_4826
      (if
       (i32.eqz
        (global.get $__asyncify_state)
       )
       (then
        (br_if $block_4826
         (local.tee $3
          (i64.ge_s
           (local.get $2)
           (i64.const 5)
          )
         )
        )
        (global.set $spawn_counter
         (i64.add
          (global.get $spawn_counter)
          (i64.const 1)
         )
        )
       )
      )
      (if
       (i32.or
        (i32.eqz
         (global.get $__asyncify_state)
        )
        (i32.eq
         (local.get $0)
         (i32.const 2)
        )
       )
       (then
        (call $Yield)
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
      (if
       (i32.eqz
        (global.get $__asyncify_state)
       )
       (then
        (local.set $2
         (i64.add
          (local.get $2)
          (i64.const 1)
         )
        )
        (br $loop_2139)
       )
      )
     )
    )
    (if
     (i32.or
      (i32.eqz
       (global.get $__asyncify_state)
      )
      (i32.eq
       (local.get $0)
       (i32.const 3)
      )
     )
     (then
      (call $Sleep
       (i64.const 50)
      )
      (drop
       (br_if $__asyncify_unwind
        (i32.const 3)
        (i32.eq
         (global.get $__asyncify_state)
         (i32.const 1)
        )
       )
      )
     )
    )
    (if
     (i32.or
      (local.tee $1
       (select
        (local.get $1)
        (local.tee $3
         (select
          (local.get $3)
          (i64.eq
           (global.get $spawn_counter)
           (i64.const 55)
          )
          (global.get $__asyncify_state)
         )
        )
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
         (local.get $0)
         (i32.const 4)
        )
       )
       (then
        (call $Print0
         (i64.const 65587)
        )
        (drop
         (br_if $__asyncify_unwind
          (i32.const 4)
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
       (local.get $1)
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
         (local.get $0)
         (i32.const 5)
        )
       )
       (then
        (call $Print0
         (i64.const 65649)
        )
        (drop
         (br_if $__asyncify_unwind
          (i32.const 5)
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
  (i64.store align=4
   (local.tee $0
    (i32.load
     (global.get $__asyncify_data)
    )
   )
   (local.get $2)
  )
  (i32.store offset=8
   (local.get $0)
   (local.get $3)
  )
  (i32.store offset=12
   (local.get $0)
   (local.get $1)
  )
  (i32.store
   (global.get $__asyncify_data)
   (i32.add
    (i32.load
     (global.get $__asyncify_data)
    )
    (i32.const 16)
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
      (call $Test13_Tasks)
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
 (func $__null_func
  (unreachable)
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
